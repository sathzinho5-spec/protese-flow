import { logger } from '../logger.js';

// 404 + erros centralizados (antes: cada rota tratava de um jeito, async sem catch derrubava)
export function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
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
