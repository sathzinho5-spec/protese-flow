import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 3001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  evolutionUrl: process.env.EVOLUTION_API_URL || (process.env.EVOLUTION_API_HOST ? `http://${process.env.EVOLUTION_API_HOST}` : 'http://localhost:8080'),
  evolutionKey: process.env.EVOLUTION_API_KEY || 'dev-evolution-key-change-me',
  evolutionInstance: process.env.EVOLUTION_INSTANCE || 'clinica-protese',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-this-jwt-secret',
  clinica: {
    nome: process.env.CLINICA_NOME || 'Clínica de Prótese Dentária',
    endereco: process.env.CLINICA_ENDERECO || 'Rua das Flores, 123 - Centro',
    horario: process.env.CLINICA_HORARIO || 'Seg a Sex 08h-18h, Sáb 08h-12h',
  },
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  dbPath: path.join(__dirname, '..', 'data', 'db.json'),
};

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres no ambiente de produção.');
}

const hasSupabase = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY));
if (process.env.NODE_ENV === 'production' && !hasSupabase && !process.env.DATABASE_URL) {
  throw new Error('Configure Supabase ou DATABASE_URL persistente no ambiente de produção.');
}

if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true });
