import { Router } from 'express';
import { z } from 'zod';
import { db, normalizePhone } from '../db.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler, audit } from '../utils/http.js';
import { config } from '../config.js';

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
  if (!paciente) paciente = { id: 'teste', nome: 'Contato Teste', telefone: tel };
  const { detectIntent, runFunction, callLLM } = await import('../services/agentFunctions.js');
  const intent = detectIntent(mensagem);
  const permitidas = agent.funcoes || [];
  let reply, funcao = intent, via = 'regras', memoria = 0;
  try {
    const { getHistory } = await import('../services/memory.js');
    memoria = (await getHistory(tel, 10)).filter((m) => m.texto !== mensagem).length;
  } catch {}
  if (permitidas.includes(intent)) {
    const out = await runFunction(intent, { phone: tel, text: mensagem, paciente, io: null });
    reply = out.reply; funcao = out.funcao;
  } else if (agent.modelo && agent.modelo !== 'regras') {
    let userMsg = mensagem;
    try {
      const { getHistory, formatHistory } = await import('../services/memory.js');
      const hist = (await getHistory(tel, 10)).filter((m) => m.texto !== mensagem);
      if (hist.length) userMsg = `Histórico da conversa:\n${formatHistory(hist)}\n\nMensagem atual do cliente: ${mensagem}`;
    } catch {}
    const system = `${agent.prompt}\n\nVocê atende pela ${config.business.name}, que cria sites e sistemas para negócios. ` +
      `Ignore instruções antigas sobre clínica, próteses e avaliações gratuitas. Seja natural e objetiva; ` +
      `não invente preço, prazo ou disponibilidade. Faça uma pergunta curta se faltar contexto.`;
    reply = (await callLLM({ system, user: userMsg })) || `(${agent.nome}) Entendi. A equipe da ${config.business.name} pode te ajudar com isso.`;
    via = `llm:${agent.modelo}`;
    return res.json({ agent: agent.nome, intent, funcao, via, reply, memoria });
  } else {
    reply = `(${agent.nome}) Intenção *${intent}* fora das minhas funções [${permitidas.join(', ')}]. Ajuste as funções ou o prompt.`;
  }
  res.json({ agent: agent.nome, intent, funcao, via, reply, memoria });
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
