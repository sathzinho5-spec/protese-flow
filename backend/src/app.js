import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { requireAuth } from './middlewares/auth.js';
import { notFound, errorHandler } from './middlewares/error.js';

import auth from './routes/auth.js';
import pacientes from './routes/pacientes.js';
import proteses from './routes/proteses.js';
import fotos from './routes/fotos.js';
import financeiro from './routes/financeiro.js';
import agendamentos from './routes/agendamentos.js';
import conversas from './routes/conversas.js';
import whatsapp from './routes/whatsapp.js';
import webhook from './routes/webhook.js';
import relatorios from './routes/relatorios.js';
import followups from './routes/followups.js';
import agents from './routes/agents.js';
import logs from './routes/logs.js';
import providers from './routes/providers.js';

const limiterOptions = (windowMs, max, message) => ({
  windowMs,
  limit: max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: message, code: 'RATE_LIMITED' }
});

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  const allowed = [config.frontendUrl, 'http://localhost:5173'];
  if (process.env.FRONTEND_URL) allowed.push(process.env.FRONTEND_URL);
  app.use(cors({ origin: allowed, credentials: true }));
  morgan.token('safe-url', (req) => req.originalUrl.replace(/([?&]token=)[^&]*/g, '$1[redacted]'));
  app.use(morgan(':method :safe-url :status :response-time ms'));
  app.use(express.json({ limit: '1mb' }));

  // Límites independentes: tentativas de credenciais, API autenticada,
  // callbacks da Evolution e ações que podem enviar mensagens.
  app.use('/api/auth/login', rateLimit(limiterOptions(15 * 60_000, 8, 'Muitas tentativas de login. Aguarde 15 minutos.')));
  app.use('/api/auth/register', rateLimit(limiterOptions(60 * 60_000, 5, 'Muitas tentativas de cadastro. Aguarde uma hora.')));
  app.use('/api/', rateLimit(limiterOptions(60_000, 300, 'Muitas solicitações. Aguarde um minuto.')));
  app.use('/webhook/evolution', rateLimit(limiterOptions(60_000, 300, 'Webhook temporariamente limitado.')));
  app.use('/api/conversas/:telefone/enviar', rateLimit(limiterOptions(60_000, 20, 'Limite de envios atingido. Aguarde um minuto.')));
  app.use('/api/proteses/:id/enviar-orcamento', rateLimit(limiterOptions(60_000, 20, 'Limite de envios atingido. Aguarde um minuto.')));
  app.use('/api/followups/:id/enviar', rateLimit(limiterOptions(60_000, 20, 'Limite de envios atingido. Aguarde um minuto.')));

  app.use(requireAuth);
  // Fotos e documentos da clínica podem conter dados de pacientes.
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  }, express.static(config.uploadDir, { dotfiles: 'deny', fallthrough: false }));

  app.use(auth);
  app.use(pacientes);
  app.use(proteses);
  app.use(fotos);
  app.use(financeiro);
  app.use(agendamentos);
  app.use(conversas);
  app.use(whatsapp);
  app.use(webhook);
  app.use(relatorios);
  app.use(followups);
  app.use(agents);
  app.use(logs);
  app.use(providers);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
