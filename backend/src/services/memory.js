import { db, normalizePhone } from '../db.js';

// Memória de conversa: últimas mensagens como contexto para os agentes.
// Fonte única: tabela `mensagens` (já registra tudo que entra e sai).
export async function getHistory(phone, limit = 12) {
  const tel = normalizePhone(phone);
  const all = await db.query('mensagens', (m) => normalizePhone(m.telefone) === tel);
  return all.slice(-limit);
}

export function formatHistory(msgs) {
  return msgs
    .map((m) => `${m.direcao === 'in' ? 'Cliente' : 'Seth Digital'}: ${m.texto}`)
    .join('\n');
}
