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

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  const allowed = [config.frontendUrl, 'http://localhost:5173'];
  if (process.env.FRONTEND_URL) allowed.push(process.env.FRONTEND_URL);
  app.use(cors({ origin: allowed, credentials: true }));
  app.use(morgan('tiny'));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploadDir));

  // rate limit só em auth + envio (evita travar webhook)
  const authLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  app.use('/api/auth/', authLimiter);

  app.use(requireAuth);

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
