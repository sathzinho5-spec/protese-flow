import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler } from '../utils/http.js';
import { parseDataAgendamento } from '../utils/data.js';

const router = Router();

function ordena(ags) {
  return [...ags].sort((a, b) => {
    if (a.dataISO && b.dataISO) return new Date(a.dataISO) - new Date(b.dataISO);
    if (a.dataISO) return -1;
    if (b.dataISO) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

router.get('/api/agendamentos', asyncHandler(async (req, res) => res.json(ordena(await db.all('agendamentos')))));

router.post('/api/agendamentos', asyncHandler(async (req, res) => {
  const body = { status: 'pendente', ...req.body };
  // P0-3: aceita dataISO explícita (datetime-local) ou tenta extrair do texto
  if (!body.dataISO && body.data) body.dataISO = parseDataAgendamento(body.data) || undefined;
  res.json(await db.insert('agendamentos', body));
}));

router.put('/api/agendamentos/:id', asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.data && !patch.dataISO) {
    const iso = parseDataAgendamento(patch.data);
    if (iso) patch.dataISO = iso;
  }
  res.json(await db.update('agendamentos', req.params.id, patch));
}));

router.delete('/api/agendamentos/:id', asyncHandler(async (req, res) => { await db.remove('agendamentos', req.params.id); res.json({ ok: true }); }));

export default router;
