// Seletor de banco: Supabase REST (service_role) > Postgres (DATABASE_URL) > SQLite.
const hasRest = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY));
const mod = hasRest
  ? await import('./db-rest.js')
  : process.env.DATABASE_URL
    ? await import('./db-pg.js')
    : await import('./db-sqlite.js');

export const { db, normalizePhone, findPacienteByPhone, findConversaByPhone } = mod;
