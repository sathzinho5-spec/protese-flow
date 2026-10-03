import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { hashSenha, confereSenha, geraToken } from '../services/auth.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler, audit } from '../utils/http.js';

const router = Router();

const emailSchema = z.string()
  .trim()
  .min(1, 'Digite seu e-mail')
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'E-mail inválido — confira: nome@clinica.com');

const registerSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  email: emailSchema,
  senha: z.string().min(10, 'Senha mínima: 10 caracteres').max(72, 'Senha muito longa (máximo: 72 caracteres)'),
  papel: z.enum(['admin', 'atendente', 'dentista']).optional()
});

router.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { nome, email, senha, papel } = registerSchema.parse(req.body);
  const existe = (await db.query('usuarios', (u) => u.email.toLowerCase() === email.toLowerCase()))[0];
  if (existe) return res.status(400).json({ error: 'E-mail já cadastrado' });
  const total = (await db.all('usuarios')).length;
  if (total > 0 && req.user?.papel !== 'admin') return res.status(req.user ? 403 : 401).json({ error: 'Apenas um administrador pode cadastrar a equipe' });
  const novo = await db.insert('usuarios', {
    nome, email: email.toLowerCase(), senhaHash: await hashSenha(senha),
    papel: total === 0 ? 'admin' : (papel || 'atendente'), ativo: true
  });
  const { senhaHash, ...safe } = novo;
  res.json({ ...safe, token: geraToken(novo) });
}));

router.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, senha } = z.object({
    email: emailSchema,
    senha: z.string().min(1, 'Digite sua senha')
  }).parse(req.body);
  const u = (await db.query('usuarios', (x) => x.email.toLowerCase() === String(email).toLowerCase()))[0];
  if (!u || u.ativo === false) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  if (!(await confereSenha(senha, u.senhaHash))) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  const { senhaHash, ...safe } = u;
  res.json({ ...safe, token: geraToken(u) });
}));

router.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'sem token' });
  res.json({ ok: true, user: req.user });
});

router.get('/api/usuarios', soAdmin, asyncHandler(async (req, res) => {
  res.json((await db.all('usuarios')).map(({ senhaHash, ...u }) => u).reverse());
}));

router.put('/api/usuarios/:id', soAdmin, asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  delete patch.senhaHash;
  if (patch.senha) { patch.senhaHash = await hashSenha(patch.senha); delete patch.senha; }
  audit(req, 'atualizar_usuario', 'usuarios', req.params.id, patch.nome || '');
  res.json(await db.update('usuarios', req.params.id, patch));
}));

router.delete('/api/usuarios/:id', soAdmin, asyncHandler(async (req, res) => {
  audit(req, 'excluir_usuario', 'usuarios', req.params.id, '');
  await db.remove('usuarios', req.params.id);
  res.json({ ok: true });
}));

export default router;
