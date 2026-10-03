import { Router } from 'express';
import { z } from 'zod';
import { db, normalizePhone, findPacienteByPhone, findConversaByPhone } from '../db.js';
import { asyncHandler } from '../utils/http.js';
import { retomarBot, pausarBot } from '../services/bot.js';
import { trySendText } from '../services/evolution.js';

const router = Router();

router.get('/api/conversas', asyncHandler(async (req, res) => {
  // P1-1: limite de 100 conversas
  const convs = (await db.all('conversas')).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 100);
  res.json(await Promise.all(convs.map(async (c) => ({ ...c, pacienteNome: (await findPacienteByPhone(c.telefone))?.nome }))));
}));

router.get('/api/conversas/:telefone/mensagens', asyncHandler(async (req, res) => {
  // P1-1: últimas 200 mensagens por conversa
  const all = await db.query('mensagens', (m) => normalizePhone(m.telefone) === normalizePhone(req.params.telefone));
  res.json(all.slice(-200));
}));

router.post('/api/conversas/:telefone/ler', asyncHandler(async (req, res) => {
  const conv = await findConversaByPhone(req.params.telefone);
  if (conv) await db.update('conversas', conv.id, { naoLidas: 0 });
  res.json({ ok: true });
}));

router.post('/api/conversas/:telefone/enviar', asyncHandler(async (req, res) => {
  const tel = normalizePhone(req.params.telefone);
  const { texto } = z.object({ texto: z.string().trim().min(1).max(4000) }).parse(req.body);
  await pausarBot(tel);
  const envio = await trySendText(tel, texto);
  await db.insert('mensagens', { telefone: tel, direcao: 'out-humano', texto, autor: req.user?.nome, enviado: envio.sent });
  const conv = await findConversaByPhone(tel);
  if (!conv) await db.insert('conversas', { telefone: tel, ultimoTexto: texto, naoLidas: 0 });
  else await db.update('conversas', conv.id, { ultimoTexto: texto });
  req.app.get('io')?.emit('mensagem:nova', { telefone: tel, direcao: 'out-humano', texto });
  res.json({ ok: true, enviado: envio.sent, aviso: envio.sent ? undefined : 'WhatsApp fora do ar — mensagem salva e marcada como pendente' });
}));

router.post('/api/conversas/:telefone/bot', asyncHandler(async (req, res) => {
  const tel = normalizePhone(req.params.telefone);
  const { ativo } = req.body;
  if (ativo) await retomarBot(tel); else await pausarBot(tel);
  res.json({ ok: true, botAtivo: !!ativo });
}));

export default router;
