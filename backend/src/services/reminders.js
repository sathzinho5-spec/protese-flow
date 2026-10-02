import cron from 'node-cron';
import { db } from '../db.js';
import { sendTextMessage } from './evolution.js';
import { logger } from '../logger.js';

// Roda a cada 30 min: lembretes de agenda + follow-ups pós-entrega
export function startReminders(io) {
  cron.schedule('*/30 * * * *', async () => {
    logger.debug('[lembretes] verificando...');
    const ags = (await db.all('agendamentos')).filter((a) =>
      ['confirmado', 'pendente'].includes(a.status) && !a.lembreteEnviado
    );
    for (const ag of ags) {
      if (!ag.enviarLembrete) continue;
      const texto = `🦷 Olá ${ag.pacienteNome}! Lembrete da *${process.env.CLINICA_NOME || 'Clínica'}*: você tem atendimento ${ag.data} — motivo: ${ag.motivo || 'avaliação'}. Responda *CONFIRMO* ou *REMARCAR*.`;
        try {
          await sendTextMessage(ag.telefone, texto);
          await db.update('agendamentos', ag.id, { lembreteEnviado: true });
          await db.insert('mensagens', { telefone: ag.telefone, direcao: 'out-bot', texto });
        io?.emit('mensagem:nova', { telefone: ag.telefone, direcao: 'out-bot', texto });
        logger.info(`[lembrete] enviado para ${ag.telefone}`);
      } catch (e) {
        logger.error('[lembrete] falha', e.message);
      }
    }
    // follow-ups vencidos (previstoPara <= agora e status agendado)
    try {
      const now = new Date().toISOString();
      const due = (await db.all('followups')).filter((f) => f.status === 'agendado' && f.previstoPara <= now);
      for (const f of due) {
        if (!f.telefone) continue;
        try {
          await sendTextMessage(f.telefone, `🦷 *${process.env.CLINICA_NOME || 'Clínica'}* — ${f.titulo}\n\n${f.mensagem}`);
          await db.update('followups', f.id, { status: 'enviado' });
          await db.insert('mensagens', { telefone: f.telefone, direcao: 'out-bot', texto: f.mensagem });
          logger.info(`[followup] enviado ${f.titulo} -> ${f.telefone}`);
        } catch (e) { logger.error('[followup] falha', e.message); }
      }
    } catch (e) { logger.error('[followup] erro', e.message); }
  });
  logger.info('[lembretes] cron ativo (*/30 * * * *)');
}
