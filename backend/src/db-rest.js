// Backend REST do Supabase — usa a API REST com service_role key.
// Funciona sem connection string (pooler não habilitado).
// Mesma API do db-sqlite/db-pg.

import axios from 'axios';
import { logger } from './logger.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

const api = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  },
  timeout: 15000
});

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
const pgCol = (app) => app.toLowerCase();

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

const pgTable = (t) => t.toLowerCase();

export const db = {
  async all(table) {
    const r = await api.get(`/${pgTable(table)}?order=createdat.asc`);
    return r.data.map((x) => mergeRow(table, x));
  },
  async find(table, id) {
    const r = await api.get(`/${pgTable(table)}?id=eq.${encodeURIComponent(id)}`);
    return mergeRow(table, r.data[0]) || undefined;
  },
  async query(table, fn) {
    const r = await api.get(`/${pgTable(table)}`);
    return r.data.map((x) => mergeRow(table, x)).filter(fn);
  },
  async insert(table, record) {
    const rec = { ...record, id: record.id || genId(), createdAt: record.createdAt || new Date().toISOString() };
    const row = splitRow(table, rec);
    const r = await api.post(`/${pgTable(table)}`, row);
    return mergeRow(table, r.data[0] || row);
  },
  async update(table, id, patch) {
    const cur = await this.find(table, id);
    if (!cur) return null;
    const merged = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    const row = splitRow(table, merged);
    const r = await api.patch(`/${pgTable(table)}?id=eq.${encodeURIComponent(id)}`, row);
    return mergeRow(table, r.data[0] || row);
  },
  async remove(table, id) {
    await api.delete(`/${pgTable(table)}?id=eq.${encodeURIComponent(id)}`);
  },
  flush() {},
};

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export async function findPacienteByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = await db.query('pacientes', () => true);
  return rows.find((p) => normalizePhone(p.telefone) === tel);
}
export async function findConversaByPhone(phone) {
  const tel = normalizePhone(phone);
  const rows = await db.query('conversas', () => true);
  return rows.find((c) => normalizePhone(c.telefone) === tel);
}
