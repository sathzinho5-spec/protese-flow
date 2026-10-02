import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler, audit } from '../utils/http.js';
import { reciboPDF } from '../services/pdf.js';

const router = Router();

router.get('/api/financeiro', asyncHandler(async (req, res) => {
  const all = await db.all('lancamentos');
  const list = await Promise.all(all.map(async (l) => ({
    ...l,
    paciente: l.pacienteId ? await db.find('pacientes', l.pacienteId) : null,
    protese: l.proteseId ? await db.find('proteses', l.proteseId) : null
  })));
  const rev = list.reverse();
  const pago = rev.filter((l) => l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendente = rev.filter((l) => l.status !== 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  res.json({ lancamentos: rev, totalRecebido: pago, totalAReceber: pendente });
}));

router.post('/api/financeiro', asyncHandler(async (req, res) => {
  const body = z.object({ descricao: z.string().min(2), valor: z.coerce.number() }).passthrough().parse(req.body);
  let pid = body.pacienteId;
  if (body.proteseId && !pid) pid = (await db.find('proteses', body.proteseId))?.pacienteId;
  const lanc = await db.insert('lancamentos', {
    status: 'pendente', forma: 'pix', tipo: 'pagamento', data: new Date().toISOString().slice(0, 10),
    ...body, pacienteId: pid, valor: Number(body.valor)
  });
  audit(req, 'criar_lancamento', 'lancamentos', lanc.id, body.descricao);
  res.json(lanc);
}));

router.put('/api/financeiro/:id', asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.valor !== undefined) patch.valor = Number(patch.valor);
  const r = await db.update('lancamentos', req.params.id, patch);
  audit(req, 'atualizar_lancamento', 'lancamentos', req.params.id, patch.status || '');
  res.json(r);
}));

router.delete('/api/financeiro/:id', soAdmin, asyncHandler(async (req, res) => {
  audit(req, 'excluir_lancamento', 'lancamentos', req.params.id, '');
  await db.remove('lancamentos', req.params.id);
  res.json({ ok: true });
}));

router.get('/api/financeiro/:id/recibo.pdf', asyncHandler(async (req, res) => {
  const lanc = await db.find('lancamentos', req.params.id);
  if (!lanc) return res.status(404).json({ error: 'não encontrado' });
  const paciente = lanc.pacienteId ? await db.find('pacientes', lanc.pacienteId) : null;
  const protese = lanc.proteseId ? await db.find('proteses', lanc.proteseId) : null;
  const buf = await reciboPDF({ lanc, paciente, protese });
  audit(req, 'gerar_recibo_pdf', 'lancamentos', lanc.id, lanc.descricao);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=recibo-${lanc.id}.pdf`);
  res.send(buf);
}));

export default router;
