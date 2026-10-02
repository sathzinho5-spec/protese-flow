import { start } from '../src/server.js';

const PORT = 3999;
const { server } = await start(PORT);
await new Promise((r) => setTimeout(r, 1200));

const checks = [];
async function check(nome, fn) {
  try { await fn(); checks.push(`OK ${nome}`); }
  catch (e) { checks.push(`FALHA ${nome}: ${e.message}`); }
}

const base = `http://localhost:${PORT}`;
let token = '';
await check('health', async () => {
  const r = await fetch(`${base}/api/health`);
  if (!r.ok) throw new Error(r.status);
});
// registra usuário efêmero (banco pode já ter usuários; tenta login admin de teste se falhar)
await check('auth', async () => {
  const email = `smoke-${Date.now()}@test.com`;
  let r = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Smoke', email, senha: '123456' }) });
  if (!r.ok) {
    r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@protesefacil.com', senha: 'Clinica123!' }) });
  }
  if (!r.ok) throw new Error('auth ' + r.status);
  const j = await r.json();
  token = j.token;
  if (!token) throw new Error('sem token');
});
const H = () => ({ Authorization: `Bearer ${token}` });
for (const p of ['/api/dashboard', '/api/pacientes', '/api/proteses', '/api/financeiro', '/api/agendamentos', '/api/conversas', '/api/agents', '/api/agent-functions', '/api/relatorios', '/api/followups', '/api/whatsapp/stats', '/api/whatsapp/feed']) {
  await check(`GET ${p}`, async () => {
    const r = await fetch(`${base}${p}`, { headers: H() });
    if (!r.ok) throw new Error(r.status);
  });
}
console.log(checks.join('\n'));
const falhas = checks.filter((c) => c.startsWith('FALHA'));
server.close(() => process.exit(falhas.length ? 1 : 0));
setTimeout(() => process.exit(1), 8000);
