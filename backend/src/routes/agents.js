import { Router } from 'express';
import { z } from 'zod';
import { db, normalizePhone } from '../db.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler, audit } from '../utils/http.js';

const router = Router();

router.get('/api/agent-functions', asyncHandler(async (req, res) => {
  const m = await import('../services/agents.js');
  res.json(m.AGENT_FUNCTIONS);
}));
router.get('/api/agents', asyncHandler(async (req, res) => res.json(await db.all('agents'))));
router.post('/api/agents', soAdmin, asyncHandler(async (req, res) => {
  const body = z.object({ nome: z.string().min(2), prompt: z.string().min(10) }).passthrough().parse(req.body);
  const a = await db.insert('agents', { ativo: true, prioridade: 50, modelo: 'regras', funcoes: [], gatilhos: '', ...body });
  audit(req, 'criar_agente', 'agents', a.id, a.nome);
  res.json(a);
}));
router.put('/api/agents/:id', soAdmin, asyncHandler(async (req, res) => {
  const a = await db.update('agents', req.params.id, req.body);
  audit(req, 'atualizar_agente', 'agents', req.params.id, req.body.nome || '');
  res.json(a);
}));
router.delete('/api/agents/:id', soAdmin, asyncHandler(async (req, res) => {
  audit(req, 'excluir_agente', 'agents', req.params.id, '');
  await db.remove('agents', req.params.id);
  res.json({ ok: true });
}));
router.post('/api/agents/:id/test', soAdmin, asyncHandler(async (req, res) => {
  const agent = await db.find('agents', req.params.id);
  if (!agent) return res.status(404).json({ error: 'agente não encontrado' });
  const { mensagem, telefone } = z.object({ mensagem: z.string().trim().min(1).max(2000), telefone: z.string().max(32).optional() }).parse(req.body);
  const tel = normalizePhone(telefone || '5511999999999');
  let paciente = (await db.query('pacientes', (p) => normalizePhone(p.telefone) === tel))[0];
  if (!paciente) paciente = { id: 'teste', nome: 'Paciente Teste', telefone: tel };
  const { detectIntent, runFunction, callLLM } = await import('../services/agentFunctions.js');
  const intent = detectIntent(mensagem);
  const permitidas = agent.funcoes || [];
  let reply, funcao = intent, via = 'regras';
  if (permitidas.includes(intent)) {
    const out = await runFunction(intent, { phone: tel, text: mensagem, paciente, io: null });
    reply = out.reply; funcao = out.funcao;
  } else if (agent.modelo && agent.modelo !== 'regras') {
    reply = (await callLLM({ system: agent.prompt, user: mensagem })) || `(${agent.nome}) Entendi. Um atendente vai te ajudar — digite ATENDENTE.`;
    via = `llm:${agent.modelo}`;
  } else {
    reply = `(${agent.nome}) Intenção *${intent}* fora das minhas funções [${permitidas.join(', ')}]. Ajuste as funções ou o prompt.`;
  }
  res.json({ agent: agent.nome, intent, funcao, via, reply });
}));
router.get('/api/agent-runs', asyncHandler(async (req, res) => res.json((await db.all('agent_runs')).reverse().slice(0, 100))));
router.get('/api/agent-settings', asyncHandler(async (req, res) => res.json((await db.all('agent_settings'))[0] || {})));
router.put('/api/agent-settings', soAdmin, asyncHandler(async (req, res) => {
  const cur = (await db.all('agent_settings'))[0];
  const s = cur ? await db.update('agent_settings', cur.id, req.body) : await db.insert('agent_settings', req.body);
  const { apiKey, ...rest } = s;
  res.json({ ...rest, apiKeySet: !!apiKey });
}));

export default router;
