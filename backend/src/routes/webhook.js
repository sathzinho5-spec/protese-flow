import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { handleIncoming } from '../services/bot.js';
import { extractIncomingMessage } from '../services/evolution.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { timingSafeEqual } from 'node:crypto';

const router = Router();

router.post('/webhook/evolution', asyncHandler(async (req, res) => {
  const received = req.get('x-webhook-secret') || '';
  const expected = config.evolutionWebhookSecret;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Webhook não autenticado' });
  }
  const incoming = extractIncomingMessage(req.body);
  if (incoming) {
    // Não grave telefone nem conteúdo da conversa em logs da aplicação.
    logger.info('[in] mensagem recebida pelo webhook');
    await handleIncoming({ ...incoming, io: req.app.get('io') });
    req.app.get('io')?.emit('conversas:update');
  }
  res.json({ ok: true });
}));

export default router;
