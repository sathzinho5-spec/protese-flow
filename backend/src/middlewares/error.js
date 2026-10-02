import { logger } from '../logger.js';

// 404 + erros centralizados (antes: cada rota tratava de um jeito, async sem catch derrubava)
export function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.isAxiosError && err.response) {
    const upstreamStatus = err.response.status;
    const upstream = err.response.data;
    const messages = [upstream?.message, upstream?.response?.message]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value) => typeof value === 'string');
    const detail = messages.join(' ');

    if (upstreamStatus === 401) {
      return res.status(502).json({ error: 'A Evolution recusou a chave configurada. Confira EVOLUTION_API_KEY em backend/.env.' });
    }
    if (upstreamStatus === 403 && /already in use|already exists|já existe/i.test(detail)) {
      return res.status(409).json({ error: `A instância já existe na Evolution. Use Buscar QR Code para conectar ${process.env.EVOLUTION_INSTANCE || 'a instância atual'}.` });
    }
    logger.warn('[evolution] resposta recusada:', upstreamStatus, detail || err.message);
    return res.status(502).json({ error: `A Evolution API recusou a solicitação (HTTP ${upstreamStatus}).` });
  }

  // Zod: devolve a primeira mensagem em PT em vez do array técnico
  const issues = err?.issues || err?.errors;
  if (Array.isArray(issues) && issues.length) {
    const first = issues[0]?.message || 'Dados inválidos';
    return res.status(400).json({ error: first });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error('[api]', req.method, req.path, err.message);
  if (err.message === 'Apenas imagens') return res.status(400).json({ error: 'Apenas imagens (até 8MB)' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo excede 8MB' });
  res.status(status).json({ error: err.message || 'Erro interno' });
}
