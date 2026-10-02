import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export async function hashSenha(senha) {
  return bcrypt.hash(String(senha), 10);
}
export async function confereSenha(senha, hash) {
  return bcrypt.compare(String(senha), String(hash));
}
export function geraToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}
