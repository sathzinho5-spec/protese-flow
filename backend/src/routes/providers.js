import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler, audit } from '../utils/http.js';
import { PROVIDER_PRESETS, masked, testProvider, defaultProvider } from '../services/ai.js';

const router = Router();

router.get('/api/ia/presets', (req, res) => res.json(PROVIDER_PRESETS));

router.get('/api/providers', asyncHandler(async (req, res) => res.json(masked(await db.all('providers')))));

router.post('/api/providers', soAdmin, asyncHandler(async (req, res) => {
  const body = z.object({
    nome: z.string().min(2), tipo: z.string().default('custom'),
    baseUrl: z.string().min(4), model: z.string().min(2),
    apiKey: z.string().min(3), ativo: z.boolean().optional(), padrao: z.boolean().optional()
  }).parse(req.body);
  const todos = await db.all('providers');
  const p = await db.insert('providers', { ativo: true, padrao: todos.length === 0, ...body });
  audit(req, 'criar_provider', 'providers', p.id, p.nome);
  res.json(masked([p])[0]);
}));

router.put('/api/providers/:id', soAdmin, asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.apiKey === '' || patch.apiKey === undefined) delete patch.apiKey;
  if (patch.padrao === true) {
    for (const o of await db.all('providers')) {
      if (o.id !== req.params.id && o.padrao) await db.update('providers', o.id, { padrao: false });
    }
  }
  const p = await db.update('providers', req.params.id, patch);
  audit(req, 'atualizar_provider', 'providers', req.params.id, p?.nome || '');
  res.json(masked([p])[0]);
}));

router.delete('/api/providers/:id', soAdmin, asyncHandler(async (req, res) => {
  audit(req, 'excluir_provider', 'providers', req.params.id, '');
  await db.remove('providers', req.params.id);
  res.json({ ok: true });
}));

router.post('/api/providers/:id/test', soAdmin, asyncHandler(async (req, res) => {
  res.json(await testProvider(req.params.id));
}));

router.get('/api/ia/status', asyncHandler(async (req, res) => {
  const provs = await db.all('providers');
  const d = await defaultProvider();
  res.json({
    total: provs.length,
    ativos: provs.filter((p) => p.ativo).length,
    padrao: d ? { id: d.id, nome: d.nome, model: d.model, tipo: d.tipo } : null,
    temChave: !!d
  });
}));

export default router;
