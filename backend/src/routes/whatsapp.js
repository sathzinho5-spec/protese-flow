import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler } from '../utils/http.js';
import { getQrCode, createInstance } from '../services/evolution.js';

const router = Router();

router.get('/api/whatsapp/qrcode', asyncHandler(async (req, res) => { res.json(await getQrCode()); }));
router.post('/api/whatsapp/criar', asyncHandler(async (req, res) => { res.json(await createInstance()); }));

router.get('/api/whatsapp/stats', asyncHandler(async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const msgs = await db.all('mensagens');
  const hojeMsgs = msgs.filter((m) => (m.createdAt || '').slice(0, 10) === hoje);
  const convs = await db.all('conversas');
  const runs = (await db.all('agent_runs')).filter((r) => (r.createdAt || '').slice(0, 10) === hoje);
  res.json({
    conversasTotal: convs.length,
    naoLidas: convs.reduce((s, c) => s + (c.naoLidas || 0), 0),
    msgsHoje: hojeMsgs.length,
    inHoje: hojeMsgs.filter((m) => m.direcao === 'in').length,
    botHoje: hojeMsgs.filter((m) => m.direcao === 'out-bot').length,
    agenteHoje: hojeMsgs.filter((m) => m.direcao === 'out-agente').length,
    humanoHoje: hojeMsgs.filter((m) => m.direcao === 'out-humano').length,
    agentesRunsHoje: runs.length,
    ultimasRuns: runs.slice(-5).reverse()
  });
}));

router.get('/api/whatsapp/feed', asyncHandler(async (req, res) => {
  res.json((await db.all('mensagens')).reverse().slice(0, 60));
}));

export default router;
