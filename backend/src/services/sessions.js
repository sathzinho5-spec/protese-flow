import { db, normalizePhone } from '../db.js';

// Sessão do bot por telefone
export async function getSession(phone) {
  const tel = normalizePhone(phone);
  let s = (await db.query('botSessions', (r) => normalizePhone(r.phone) === tel))[0];
  if (!s) s = await db.insert('botSessions', { phone: tel, step: 'menu', data: {}, botAtivo: true });
  return s;
}

export async function setSession(phone, patch) {
  const s = await getSession(phone);
  return db.update('botSessions', s.id, patch);
}

export async function retomarBot(phone) {
  await setSession(phone, { botAtivo: true, step: 'menu' });
}

export async function pausarBot(phone) {
  await setSession(phone, { botAtivo: false });
}
