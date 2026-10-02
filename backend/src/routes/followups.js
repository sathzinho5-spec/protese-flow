import { Router } from 'express';
import { db, normalizePhone } from '../db.js';
import { asyncHandler, audit } from '../utils/http.js';
import { trySendText } from '../services/evolution.js';

const router = Router();

router.get('/api/followups', asyncHandler(async (req, res) => {
  const all = await db.all('followups');
  res.json((await Promise.all(all.map(async (f) => ({
    ...f,
    paciente: f.pacienteId ? await db.find('pacientes', f.pacienteId) : null,
    protese: f.proteseId ? await db.find('proteses', f.proteseId) : null
  })))).reverse());
}));

router.put('/api/followups/:id', asyncHandler(async (req, res) => {
  const f = await db.update('followups', req.params.id, req.body);
  audit(req, 'atualizar_followup', 'followups', req.params.id, req.body.status || '');
  if (req.body.enviar === true && f?.telefone) await trySendText(normalizePhone(f.telefone), f.mensagem);
  res.json(f);
}));

router.post('/api/followups/:id/enviar', asyncHandler(async (req, res) => {
  const f = await db.find('followups', req.params.id);
  if (!f?.telefone) return res.status(400).json({ error: 'sem telefone' });
  const envio = await trySendText(normalizePhone(f.telefone), f.mensagem);
  if (envio.sent) await db.update('followups', f.id, { status: 'enviado' });
  audit(req, 'enviar_followup', 'followups', f.id, f.titulo);
  res.json({ ok: true, enviado: envio.sent });
}));

export default router;
