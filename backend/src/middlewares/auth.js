import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

export async function requireAuth(req, res, next) {
  try {
    if (req.path === '/api/auth/login' || req.path.startsWith('/webhook/') || req.path === '/api/health') return next();
    // Permite criar apenas o primeiro admin sem sessão; depois exige login.
    if (req.path === '/api/auth/register' && (await db.all('usuarios')).length === 0) return next();
    const h = req.headers.authorization || '';
    let token = h.startsWith('Bearer ') ? h.slice(7) : null;
    // P0-1: links de PDF/impressão abertos em nova aba não levam header —
    // aceita ?token= apenas em GET (nunca em escrita).
    if (!token && req.method === 'GET' && typeof req.query?.token === 'string') token = req.query.token;
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    try {
      req.user = jwt.verify(token, config.jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Sessão expirada' });
    }
  } catch (e) {
    return next(e);
  }
}

export function requireRole(...papeis) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!papeis.includes(req.user.papel)) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}
export const soAdmin = requireRole('admin');
