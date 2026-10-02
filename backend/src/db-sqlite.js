// Backend SQLite da camada db (API idêntica à do Postgres).
// Ver src/db.js (seletor) e src/db-pg.js. Arquivo gerado a partir do db.js original.
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { logger } from './logger.js';

// SQLite (nativo do Node, WAL) com a MESMA API do db anterior —
// nenhuma rota/service precisou mudar. Campos desconhecidos vão para
// a coluna `extras` (JSON) e voltam mesclados na leitura.
// Na primeira subida, importa data/db.json automaticamente.

const DB_FILE = path.join(path.dirname(config.dbPath), 'clinica.db');

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

function colType(def) {
  if (def.endsWith(':num')) return 'REAL';
  if (def.endsWith(':bool')) return 'INTEGER';
  if (def.endsWith(':json')) return 'TEXT';
  return 'TEXT';
}
function colName(def) { return def.split(':')[0]; }
function isBool(def) { return def.endsWith(':bool'); }
function isJson(def) { return def.endsWith(':json'); }

const sqlite = new DatabaseSync(DB_FILE);
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

for (const [table, cols] of Object.entries(COLS)) {
  const defs = cols.map((c) => `${colName(c)} ${colType(c)}`).join(', ');
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, createdAt TEXT, updatedAt TEXT, extras TEXT, ${defs})`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_created ON ${table}(createdAt)`);
}
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_mensagens_tel ON mensagens(telefone)');
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_conversas_tel ON conversas(telefone)');
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_pacientes_tel ON pacientes(telefone)');

// Repara valores booleanos legados gravados como texto "1.0"/"0.0"
(function fixBools() {
  for (const [table, cols] of Object.entries(COLS)) {
    for (const def of cols) {
      if (!isBool(def)) continue;
      const c = colName(def);
      try {
        sqlite.exec(`UPDATE ${table} SET ${c} = 1 WHERE ${c} IN ('1', '1.0')`);
        sqlite.exec(`UPDATE ${table} SET ${c} = 0 WHERE ${c} IN ('0', '0.0')`);
      } catch {}
    }
  }
})();

function encode(def, v) {
  if (v === undefined || v === null) return null;
  if (isJson(def)) return typeof v === 'string' ? v : JSON.stringify(v);
  if (isBool(def)) return v ? 1 : 0;
  if (def.endsWith(':num')) return Number(v);
  return String(v);
}
function decode(def, v) {
  if (v === null || v === undefined) return undefined;
  if (isJson(def)) { try { return JSON.parse(v); } catch { return v; } }
  if (isBool(def)) return v === 1 || v === '1' || v === '1.0' || v === 1.0 || v === true;
  if (def.endsWith(':num')) return Number(v);
  return v;
}

function toRow(table, rec) {
  const cols = COLS[table];
  const rest = { ...rec };
  const row = { id: rec.id, createdAt: rec.createdAt || null, updatedAt: rec.updatedAt || null };
  for (const def of cols) {
    const name = colName(def);
    row[name] = encode(def, rec[name]);
    delete rest[name];
  }
  delete rest.id; delete rest.createdAt; delete rest.updatedAt;
  row.extras = Object.keys(rest).length ? JSON.stringify(rest) : null;
  return row;
}

function fromRow(table, row) {
  if (!row) return row;
  const cols = COLS[table];
  const rec = { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
  for (const def of cols) {
    const name = colName(def);
    const v = decode(def, row[name]);
    if (v !== undefined) rec[name] = v;
  }
  if (row.extras) { try { Object.assign(rec, JSON.parse(row.extras)); } catch {} }
  return rec;
}

function insertStmt(table) {
  const names = ['id', 'createdAt', 'updatedAt', 'extras', ...COLS[table].map(colName)];
  return sqlite.prepare(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`);
}
const stmtCache = {};
function stmt(table) {
  if (!stmtCache[table]) stmtCache[table] = insertStmt(table);
  return stmtCache[table];
}

// Migração única do JSON legado
(function migrate() {
  try {
    const total = sqlite.prepare("SELECT COUNT(*) AS n FROM usuarios").get().n
      + sqlite.prepare("SELECT COUNT(*) AS n FROM pacientes").get().n;
    if (total > 0) return;
    if (!fs.existsSync(config.dbPath)) return;
    const data = JSON.parse(fs.readFileSync(config.dbPath, 'utf-8'));
    let n = 0;
    for (const table of Object.keys(COLS)) {
      for (const rec of (data[table] || [])) {
        const row = toRow(table, { ...rec, id: rec.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, createdAt: rec.createdAt || new Date().toISOString() });
        const names = ['id', 'createdAt', 'updatedAt', 'extras', ...COLS[table].map(colName)];
        stmt(table).run(...names.map((k) => row[k] ?? null));
        n++;
      }
    }
    fs.copyFileSync(config.dbPath, config.dbPath + '.legado-bak');
    logger.info(`[db] migrados ${n} registros do JSON para SQLite`);
  } catch (e) {
    logger.error('[db] migração falhou:', e.message);
  }
})();

function genId() { return `${Date.now()}-${Math.floor(Math.random() * 10000)}`; }

export const db = {
  all(table) {
    return sqlite.prepare(`SELECT * FROM ${table} ORDER BY createdAt ASC`).all().map((r) => fromRow(table, r));
  },
  find(table, id) {
    return fromRow(table, sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(String(id))) || undefined;
  },
  query(table, fn) {
    return sqlite.prepare(`SELECT * FROM ${table}`).all().map((r) => fromRow(table, r)).filter(fn);
  },
  insert(table, record) {
    const rec = { ...record, id: record.id || genId(), createdAt: new Date().toISOString() };
    const row = toRow(table, rec);
    const names = ['id', 'createdAt', 'updatedAt', 'extras', ...COLS[table].map(colName)];
    stmt(table).run(...names.map((k) => row[k] ?? null));
    return fromRow(table, row);
  },
  update(table, id, patch) {
    const cur = sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(String(id));
    if (!cur) return null;
    const merged = { ...fromRow(table, cur), ...patch, updatedAt: new Date().toISOString() };
    const row = toRow(table, merged);
    const sets = ['updatedAt', 'extras', ...COLS[table].map(colName)].map((k) => `${k} = ?`).join(', ');
    sqlite.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...(['updatedAt', 'extras', ...COLS[table].map(colName)].map((k) => row[k] ?? null)), String(id));
    return fromRow(table, row);
  },
  remove(table, id) {
    sqlite.prepare(`DELETE FROM ${table} WHERE id = ?`).run(String(id));
  },
  flush() {
    try { sqlite.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch {}
  },
};

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function findPacienteByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = sqlite.prepare('SELECT * FROM pacientes').all().map((r) => fromRow('pacientes', r));
  return rows.find((p) => normalizePhone(p.telefone) === tel);
}
export function findConversaByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = sqlite.prepare('SELECT * FROM conversas').all().map((r) => fromRow('conversas', r));
  return rows.find((c) => normalizePhone(c.telefone) === tel);
}
