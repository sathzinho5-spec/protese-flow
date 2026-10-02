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
  const nova = await db.insert('proteses', { status: 'orçado', valor: Number(body.valor || 0), garantiaMeses: 12, ...body });
  audit(req, 'criar_protese', 'proteses', nova.id, nova.tipo);
  res.json(nova);
}));

router.put('/api/proteses/:id', asyncHandler(async (req, res) => {
  const antes = await db.find('proteses', req.params.id);
  const patch = { ...req.body };
  if (patch.valor !== undefined) patch.valor = Number(patch.valor);
  const dep = await db.update('proteses', req.params.id, patch);
  audit(req, 'atualizar_protese', 'proteses', req.params.id, `${antes?.status} -> ${patch.status || antes?.status}`);
  if (patch.status === 'entregue' && antes?.status !== 'entregue' && dep) {
    const pac = dep.pacienteId ? await db.find('pacientes', dep.pacienteId) : null;
    const base = Date.now();
    const etapas = [
      { dias: 7, titulo: 'Ajuste inicial (7 dias)', msg: 'Olá! Como está a adaptação da prótese? Qualquer incômodo, agende um ajuste gratuito.' },
      { dias: 30, titulo: 'Revisão 30 dias', msg: 'Revisão de 30 dias da sua prótese. Está tudo confortável? Quer agendar revisão?' },
      { dias: 180, titulo: 'Manutenção 6 meses', msg: 'Hora da manutenção preventiva da sua prótese (limpeza + aperto). Vamos agendar?' },
      { dias: 365, titulo: 'Garantia 12 meses', msg: 'Sua garantia de 1 ano vence em breve. Agende avaliação gratuita de garantia.' },
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
  if (!req.file) return res.status(400).json({ error: 'arquivo foto obrigatório' });
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'prótese não encontrada' });
  const foto = await db.insert('fotos', {
    proteseId: req.params.id, url: `/uploads/${req.file.filename}`,
    legenda: req.body.legenda || req.body.etapa || 'evolução',
    etapa: req.body.etapa || 'geral', autor: req.user?.nome || 'atendente'
  });
  res.json(foto);
}));

// pdf + envio
router.get('/api/proteses/:id/orcamento.pdf', asyncHandler(async (req, res) => {
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'não encontrada' });
  const paciente = protese.pacienteId ? await db.find('pacientes', protese.pacienteId) : null;
  const lancs = await db.query('lancamentos', (l) => l.proteseId === protese.id);
  const buf = await orcamentoPDF({ protese, paciente, lancamentos: lancs });
  audit(req, 'gerar_orcamento_pdf', 'proteses', protese.id, paciente?.nome);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=orcamento-${protese.id}.pdf`);
  res.send(buf);
}));

router.post('/api/proteses/:id/enviar-orcamento', asyncHandler(async (req, res) => {
  const protese = await db.find('proteses', req.params.id);
  if (!protese) return res.status(404).json({ error: 'não encontrada' });
  const paciente = protese.pacienteId ? await db.find('pacientes', protese.pacienteId) : null;
  if (!paciente?.telefone) return res.status(400).json({ error: 'paciente sem WhatsApp' });
  const texto = `🦷 *Orçamento — ${config.clinica.nome}*\n\n👤 ${paciente.nome}\n🔧 ${protese.tipo}\n💰 Valor: R$ ${protese.valor}\n📅 Previsão: ${protese.previsao || 'a combinar'}\n\nResponda *APROVO* para aprovar ou *ATENDENTE* para falar conosco.`;
  const envio = await trySendText(normalizePhone(paciente.telefone), texto);
  await db.insert('mensagens', { telefone: normalizePhone(paciente.telefone), direcao: 'out-humano', texto, autor: req.user?.nome, enviado: envio.sent });
  audit(req, 'enviar_orcamento_whats', 'proteses', protese.id, paciente.nome);
  res.json({ ok: true, enviado: envio.sent });
}));

export default router;
