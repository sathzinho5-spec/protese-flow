import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { handleIncoming } from '../services/bot.js';
import { extractIncomingMessage } from '../services/evolution.js';
import { logger } from '../logger.js';

const router = Router();

// Sem auth (Evolution chama direto) — valida assinatura futuramente via API key header
router.post('/webhook/evolution', asyncHandler(async (req, res) => {
  const incoming = extractIncomingMessage(req.body);
  if (incoming) {
    logger.info('[in]', incoming.phone, incoming.text?.slice(0, 80));
    await handleIncoming({ ...incoming, io: req.app.get('io') });
    req.app.get('io')?.emit('conversas:update');
  }
  res.json({ ok: true });
}));

export default router;
