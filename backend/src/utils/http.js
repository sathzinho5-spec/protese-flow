export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function audit(req, acao, entidade, entidadeId, detalhe) {
  // fire-and-forget (nunca quebra a requisição)
  import('../db.js').then(({ db }) => {
    try {
      const r = db.insert('logs', {
        autor: req.user?.nome || req.user?.email || 'sistema',
        papel: req.user?.papel, acao, entidade, entidadeId, detalhe
      });
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {}
  }).catch(() => {});
}
