// Backend Postgres/Supabase da camada db — MESMA API do SQLite.
// Colunas no banco são minúsculas (createdat, pacienteid, dataiso...);
// o driver mapeia p/ camelCase do app. Extras desconhecidos vão p/ jsonb.

import pg from 'pg';
import { logger } from './logger.js';

const COLS = {
  usuarios: ['nome', 'email', 'senhaHash', 'papel', 'ativo:bool'],
  pacientes: ['nome', 'telefone', 'nascimento', 'observacoes', 'origem'],
  proteses: ['pacienteId', 'tipo', 'status', 'valor:num', 'previsao', 'garantiaMeses:num', 'observacoes'],
  agendamentos: ['pacienteId', 'pacienteNome', 'telefone', 'data', 'dataISO', 'motivo', 'dentista', 'status', 'origem', 'lembreteEnviado:bool', 'enviarLembrete:bool', 'motivoCancel'],
  conversas: ['telefone', 'ultimoTexto', 'naoLidas:num'],
  mensagens: ['telefone', 'direcao', 'texto', 'autor', 'enviado:bool'],
  botSessions: ['phone', 'step', 'data:json', 'botAtivo:bool'],
  lancamentos: ['descricao', 'valor:num', 'proteseId', 'pacienteId', 'forma', 'tipo', 'status', 'data'],
  fotos: ['proteseId', 'url', 'legenda', 'etapa', 'autor'],
  logs: ['autor', 'papel', 'acao', 'entidade', 'entidadeId', 'detalhe'],
  followups: ['proteseId', 'pacienteId', 'telefone', 'titulo', 'mensagem', 'previstoPara', 'status', 'dias:num'],
  agents: ['nome', 'descricao', 'prompt', 'funcoes:json', 'gatilhos', 'prioridade:num', 'ativo:bool', 'modelo'],
  agent_runs: ['agentId', 'agentNome', 'telefone', 'entrada', 'intencao', 'funcao', 'via', 'resposta'],
  agent_settings: ['provider', 'model', 'baseUrl', 'apiKey'],
  providers: ['nome', 'tipo', 'baseUrl', 'model', 'apiKey', 'ativo:bool', 'padrao:bool', 'ultimoTeste', 'ultimoStatus'],
};

const colName = (d) => d.split(':')[0];
const isBool = (d) => d.endsWith(':bool');
const isJson = (d) => d.endsWith(':json');
const isNum = (d) => d.endsWith(':num');
const pgCol = (app) => app.toLowerCase(); // dataISO -> dataiso

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
});
pool.on('error', (e) => logger.error('[db-pg] pool:', e.message));

function encode(def, v) {
  if (v === undefined || v === null) return null;
  if (isJson(def)) return typeof v === 'string' ? v : JSON.stringify(v);
  if (isBool(def)) return !!v;
  if (isNum(def)) return Number(v);
  return String(v);
}
function decode(def, v) {
  if (v === null || v === undefined) return undefined;
  if (isJson(def)) {
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return v; }
  }
  if (isBool(def)) return v === true || v === 1 || v === '1';
  if (isNum(def)) return Number(v);
  return v;
}

function splitRow(table, rec) {
  const rest = { ...rec };
  const row = { id: rec.id ?? null, createdat: rec.createdAt ?? null, updatedat: rec.updatedAt ?? null };
  for (const def of COLS[table]) {
    const name = colName(def);
    row[pgCol(name)] = encode(def, rec[name]);
    delete rest[name];
  }
  delete rest.id; delete rest.createdAt; delete rest.updatedAt;
  row.extras = Object.keys(rest).length ? rest : null;
  return row;
}

function mergeRow(table, row) {
  if (!row) return row;
  const rec = { id: row.id, createdAt: row.createdat, updatedAt: row.updatedat };
  for (const def of COLS[table]) {
    const name = colName(def);
    const v = decode(def, row[pgCol(name)]);
    if (v !== undefined) rec[name] = v;
  }
  if (row.extras && typeof row.extras === 'object') Object.assign(rec, row.extras);
  return rec;
}

function genId() { return `${Date.now()}-${Math.floor(Math.random() * 10000)}`; }

export const db = {
  all(table) {
    return pool.query(`SELECT * FROM ${table} ORDER BY createdat ASC`)
      .then((r) => r.rows.map((x) => mergeRow(table, x)));
  },
  find(table, id) {
    return pool.query(`SELECT * FROM ${table} WHERE id = $1`, [String(id)])
      .then((r) => mergeRow(table, r.rows[0]) || undefined);
  },
  query(table, fn) {
    return pool.query(`SELECT * FROM ${table}`)
      .then((r) => r.rows.map((x) => mergeRow(table, x)).filter(fn));
  },
  insert(table, record) {
    const rec = { ...record, id: record.id || genId(), createdAt: record.createdAt || new Date().toISOString() };
    const row = splitRow(table, rec);
    const keys = Object.keys(row);
    const vals = keys.map((k) => (k === 'extras' ? (row[k] ? JSON.stringify(row[k]) : null) : row[k]));
    return pool.query(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      vals
    ).then(() => mergeRow(table, { ...row, extras: row.extras }));
  },
  update(table, id, patch) {
    return pool.query(`SELECT * FROM ${table} WHERE id = $1`, [String(id)]).then((cur) => {
      if (!cur.rows[0]) return null;
      const merged = { ...mergeRow(table, cur.rows[0]), ...patch, updatedAt: new Date().toISOString() };
      const row = splitRow(table, merged);
      const keys = Object.keys(row).filter((k) => k !== 'id');
      const vals = keys.map((k) => (k === 'extras' ? (row[k] ? JSON.stringify(row[k]) : null) : row[k]));
      return pool.query(
        `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
        [...vals, String(id)]
      ).then(() => mergeRow(table, { ...row, extras: row.extras }));
    });
  },
  remove(table, id) {
    return pool.query(`DELETE FROM ${table} WHERE id = $1`, [String(id)]).then(() => {});
  },
  flush() {},
};

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export async function findPacienteByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = (await pool.query('SELECT * FROM pacientes')).rows.map((r) => mergeRow('pacientes', r));
  return rows.find((p) => normalizePhone(p.telefone) === tel);
}
export async function findConversaByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = (await pool.query('SELECT * FROM conversas')).rows.map((r) => mergeRow('conversas', r));
  return rows.find((c) => normalizePhone(c.telefone) === tel);
}
