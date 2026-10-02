import { createServer } from 'http';
import { Server } from 'socket.io';
import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db.js';
import { startReminders } from './services/reminders.js';
import { seedAgents } from './services/agentFunctions.js';
import { seedProviders } from './services/ai.js';

export async function start(port = config.port) {
  await seedAgents();
  await seedProviders();
  const app = buildApp();
  const http = createServer(app);
  const io = new Server(http, { cors: { origin: [config.frontendUrl, 'http://localhost:5173'] } });
  app.set('io', io);
  io.on('connection', () => logger.info('[socket] cliente conectado'));

  const server = http.listen(port, '0.0.0.0', () => logger.info(`✅ Backend rodando na porta ${port}`));
  startReminders(io);

  const shutdown = () => {
    logger.info('[server] encerrando...');
    server.close(() => { try { db.flush(); } catch {} process.exit(0); });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return { app, http, io, server };
}
