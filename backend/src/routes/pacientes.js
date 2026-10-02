import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { asyncHandler, audit } from '../utils/http.js';

const router = Router();

router.get('/api/pacientes', asyncHandler(async (req, res) => res.json((await db.all('pacientes')).reverse())));

router.post('/api/pacientes', asyncHandler(async (req, res) => {
  const body = z.object({
    nome: z.string().min(2), telefone: z.string().min(8),
    nascimento: z.string().optional(), observacoes: z.string().optional(),
    origem: z.string().optional()
  }).passthrough().parse(req.body);
  audit(req, 'criar_paciente', 'pacientes', '', body.nome);
  res.json(await db.insert('pacientes', body));
}));

router.put('/api/pacientes/:id', asyncHandler(async (req, res) => res.json(await db.update('pacientes', req.params.id, req.body))));
router.delete('/api/pacientes/:id', asyncHandler(async (req, res) => { await db.remove('pacientes', req.params.id); res.json({ ok: true }); }));

export default router;
