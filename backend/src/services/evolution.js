import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const api = axios.create({
  baseURL: config.evolutionUrl,
  headers: { apikey: config.evolutionKey, 'Content-Type': 'application/json' },
  timeout: 15000
});

export async function sendTextMessage(phone, text) {
  // phone: só dígitos com DDI, ex 5511999999999
  try {
    const res = await api.post(`/message/sendText/${config.evolutionInstance}`, { number: phone, text });
    return res.data;
  } catch (err) {
    logger.error('[evolution] erro ao enviar:', err.response?.data || err.message);
    // Em modo dev sem Evolution, apenas loga (mock)
    if (err.code === 'ECONNREFUSED') {
      logger.info(`[MOCK SEND -> ${phone}]: ${String(text).slice(0, 120)}`);
      return { mock: true };
    }
    throw err;
  }
}

export async function getQrCode() {
  try {
    const res = await api.get(`/instance/connect/${config.evolutionInstance}`);
    return res.data;
  } catch (err) {
    logger.error('[evolution] erro QR:', err.response?.data || err.message);
    throw err;
  }
}

export async function configureWebhook() {
  const url = process.env.EVOLUTION_WEBHOOK_URL || 'http://host.docker.internal:3001/webhook/evolution';
  const res = await api.post(`/webhook/set/${encodeURIComponent(config.evolutionInstance)}`, {
    webhook: {
      enabled: true,
      url,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT']
    }
  });
  return res.data;
}

export async function createInstance() {
  try {
    const res = await api.post('/instance/create', {
      instanceName: config.evolutionInstance,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    });
    return res.data;
  } catch (err) {
    logger.error('[evolution] erro create:', err.response?.data || err.message);
    throw err;
  }
}

// P0-2: envio que nunca estoura — devolve { sent } para o fluxo salvar
// a mensagem mesmo com o WhatsApp fora do ar.
export async function trySendText(phone, text) {
  try {
    const r = await sendTextMessage(phone, text);
    return { sent: true, mock: !!r?.mock };
  } catch (err) {
    logger.warn('[evolution] envio pendente:', err.response?.data || err.message);
    return { sent: false, error: err.response?.data?.error || err.message };
  }
}

export function extractIncomingMessage(payload) {
  // Evolution API v2 webhook: events.messages.upsert
  try {
    const msg = payload?.data?.message || payload?.message || {};
    const key = payload?.data?.key || payload?.key || {};
    const remoteJid = String(key.remoteJid || '').toLowerCase();
    const fromMe = key.fromMe || false;
    if (fromMe) return null;
    // Never let the clinic bot answer WhatsApp groups or status broadcasts.
    if (payload?.data?.isGroup === true || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return null;

    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const pushName = payload?.data?.pushName || 'Paciente';

    const text = msg.conversation
      || msg.extendedTextMessage?.text
      || msg.buttonsResponseMessage?.selectedButtonId
      || msg.listResponseMessage?.title
      || '';

    if (!text || !phone) return null;
    return { phone, text: String(text).trim(), pushName };
  } catch {
    return null;
  }
}
