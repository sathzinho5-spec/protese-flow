// Migra SQLite -> Supabase REST
import { db as sdb } from '../src/db-sqlite.js';
import { db as rdb } from '../src/db-rest.js';

const TABLES = ['usuarios', 'pacientes', 'proteses', 'agendamentos', 'conversas', 'mensagens', 'botSessions', 'lancamentos', 'fotos', 'logs', 'followups', 'agents', 'agent_runs', 'agent_settings', 'providers'];

let total = 0;
for (const t of TABLES) {
  const rows = sdb.all(t);
  const dest = await rdb.all(t);
  const ids = new Set(dest.map((r) => String(r.id)));
  let n = 0;
  for (const r of rows) {
    if (ids.has(String(r.id))) continue;
    await rdb.insert(t, r);
    n++;
  }
  total += n;
  console.log(`${t}: ${n} novos (${rows.length} origem)`);
}
console.log(`Migração concluída: ${total} registros.`);
process.exit(0);
