import { Router } from 'express';
import { z } from 'zod';
import { db, normalizePhone } from '../db.js';
import { config } from '../config.js';
import { soAdmin } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { asyncHandler, audit } from '../utils/http.js';
import { orcamentoPDF } from '../services/pdf.js';
import { trySendText } from '../services/evolution.js';

const router = Router();

router.get('/api/proteses', asyncHandler(async (req, res) => {
  const all = await db.all('proteses');
  const list = await Promise.all(all.map(async (p) => {
    const lancs = await db.query('lancamentos', (l) => l.proteseId === p.id);
    const pago = lancs.filter((l) => l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    const valor = Number(p.valor || 0);
    return { ...p, paciente: p.pacienteId ? await db.find('pacientes', p.pacienteId) : null, totalPago: pago, saldo: valor - pago, totalLancamentos: lancs.length };
  }));
  res.json(list.reverse());
}));

router.post('/api/proteses', asyncHandler(async (req, res) => {
  const body = z.object({ pacienteId: z.string().min(1), tipo: z.string().min(2) }).passthrough().parse(req.body);
  const nova = await db.insert('proteses', { status: 'Briefing', valor: Number(body.valor || 0), ...body });
  audit(req, 'criar_protese', 'proteses', nova.id, nova.tipo);
  res.json(nova);
}));

router.put('/api/proteses/:id', asyncHandler(async (req, res) => {
  const antes = await db.find('proteses', req.params.id);
  const patch = { ...req.body };
  if (patch.valor !== undefined) patch.valor = Number(patch.valor);
  const dep = await db.update('proteses', req.params.id, patch);
  audit(req, 'atualizar_protese', 'proteses', req.params.id, `${antes?.status} -> ${patch.status || antes?.status}`);
  const finalizado = ['concluído', 'concluido', 'entregue'].includes(String(patch.status || '').toLowerCase());
  const jaFinalizado = ['concluído', 'concluido', 'entregue'].includes(String(antes?.status || '').toLowerCase());
  if (finalizado && !jaFinalizado && dep) {
    const pac = dep.pacienteId ? await db.find('pacientes', dep.pacienteId) : null;
    const base = Date.now();
    const etapas = [
      { dias: 7, titulo: 'Retorno sobre a entrega', msg: 'Olá! Passando para confirmar se recebeu tudo certo. Se houver algum ajuste ou dúvida, pode responder por aqui.' },
      { dias: 30, titulo: 'Acompanhamento do projeto', msg: 'Olá! Como está a experiência com o projeto entregue? Se precisar de suporte, conte para a equipe.' },
    ];
    for (const e of etapas) {
      await db.insert('followups', {
        proteseId: dep.id, pacienteId: dep.pacienteId, telefone: pac?.telefone,
        titulo: e.titulo, mensagem: e.msg, previstoPara: new Date(base + e.dias * 864e5).toISOString(),
        status: 'agendado', dias: e.dias
      });
    }
  }
  res.json(dep);
}));

router.delete('/api/proteses/:id', soAdmin, asyncHandler(async (req, res) => {
  audit(req, 'excluir_protese', 'proteses', req.params.id, '');
  await db.remove('proteses', req.params.id);
  res.json({ ok: true });
}));

// fotos
router.get('/api/proteses/:id/fotos', asyncHandler(async (req, res) => {
  res.json((await db.query('fotos', (f) => f.proteseId === req.params.id)).reverse());
}));
router.post('/api/proteses/:id/fotos', upload.single('foto'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie uma imagem ou PDF.' });
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'Projeto não encontrado' });
  const foto = await db.insert('fotos', {
    proteseId: req.params.id, url: `/uploads/${req.file.filename}`,
    legenda: req.file.originalname,
    etapa: req.body.etapa || 'Material do projeto',
    originalName: req.file.originalname, mimeType: req.file.mimetype,
    autor: req.user?.nome || 'equipe'
  });
  res.json(foto);
}));

// pdf + envio
router.get('/api/proteses/:id/orcamento.pdf', asyncHandler(async (req, res) => {
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'Projeto não encontrado' });
  const paciente = protese.pacienteId ? await db.find('pacientes', protese.pacienteId) : null;
  const lancs = await db.query('lancamentos', (l) => l.proteseId === protese.id);
  const buf = await orcamentoPDF({ protese, paciente, lancamentos: lancs });
  audit(req, 'gerar_orcamento_pdf', 'proteses', protese.id, paciente?.nome);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=proposta-${protese.id}.pdf`);
  res.send(buf);
}));

router.post('/api/proteses/:id/enviar-orcamento', asyncHandler(async (req, res) => {
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'Projeto não encontrado' });
  const paciente = protese.pacienteId ? await db.find('pacientes', protese.pacienteId) : null;
  if (!paciente?.telefone) return res.status(400).json({ error: 'Cliente sem WhatsApp cadastrado' });
  const texto = `*Proposta — ${config.business.name}*\n\nCliente: ${paciente.empresa || paciente.nome}\nProjeto: ${protese.tipo}\nInvestimento: R$ ${protese.valor || 'a combinar'}\nPrevisão: ${protese.previsao || 'a combinar'}\n\nSe quiser conversar sobre algum ponto, é só responder esta mensagem.`;
  const envio = await trySendText(normalizePhone(paciente.telefone), texto);
  await db.insert('mensagens', { telefone: normalizePhone(paciente.telefone), direcao: 'out-humano', texto, autor: req.user?.nome, enviado: envio.sent });
  audit(req, 'enviar_orcamento_whats', 'proteses', protese.id, paciente.nome);
  res.json({ ok: true, enviado: envio.sent });
}));

export default router;
