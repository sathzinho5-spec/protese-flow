import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';

let server;
let base;
let token;
let attendantToken;

before(async () => {
  const app = buildApp();
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  token = jwt.sign({ id: 'test-user', nome: 'Teste', email: 'teste@example.com', papel: 'admin' }, config.jwtSecret);
  attendantToken = jwt.sign({ id: 'test-attendant', nome: 'Atendente', email: 'atendente@example.com', papel: 'atendente' }, config.jwtSecret);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('rotas clínicas exigem autenticação', async () => {
  const response = await fetch(`${base}/api/pacientes`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'AUTH_REQUIRED');
});

test('fotos privadas não são servidas sem sessão', async () => {
  const response = await fetch(`${base}/uploads/arquivo-inexistente.jpg`);
  assert.equal(response.status, 401);
});

test('webhook rejeita chamadas sem o segredo compartilhado', async () => {
  const response = await fetch(`${base}/webhook/evolution`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'messages.upsert' })
  });
  assert.equal(response.status, 401);
});

test('webhook aceita a chave configurada pela Evolution', async () => {
  const response = await fetch(`${base}/webhook/evolution`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': config.evolutionWebhookSecret },
    body: JSON.stringify({ event: 'messages.upsert', data: {} })
  });
  assert.equal(response.status, 200);
});

test('rotas principais de leitura respondem com sessão válida', async () => {
  for (const path of ['/api/dashboard', '/api/pacientes', '/api/proteses', '/api/conversas', '/api/agendamentos', '/api/financeiro', '/api/relatorios', '/api/followups', '/api/whatsapp/stats', '/api/whatsapp/feed']) {
    const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200, `${path} deveria responder 200`);
    const payload = await response.json();
    const objectResponses = ['/api/dashboard', '/api/financeiro', '/api/relatorios', '/api/whatsapp/stats'];
    if (path === '/api/financeiro') assert.ok(Array.isArray(payload.lancamentos), 'financeiro deveria retornar lançamentos');
    else if (objectResponses.includes(path)) assert.equal(typeof payload, 'object', `${path} deveria retornar dados`);
    else assert.ok(Array.isArray(payload), `${path} deveria retornar uma lista`);
  }
});

test('perfis de atendente não podem alterar nem testar agentes de IA', async () => {
  const response = await fetch(`${base}/api/agents/teste/test`, {
    method: 'POST',
    headers: { authorization: `Bearer ${attendantToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ mensagem: 'teste' })
  });
  assert.equal(response.status, 403);
});

test('login limita tentativas repetidas', async () => {
  let response;
  for (let attempt = 0; attempt < 9; attempt++) {
    response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'inexistente@example.com', senha: 'senha-incorreta' })
    });
  }
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, 'RATE_LIMITED');
});
