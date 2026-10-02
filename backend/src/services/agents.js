import { db, normalizePhone } from '../db.js';
import { AGENT_FUNCTIONS, detectIntent, runFunction, callLLM, seedAgents } from './agentFunctions.js';
import { trySendText } from './evolution.js';
import { pausarBot } from './sessions.js';

seedAgents();

async function matchAgent(text) {
  const ativos = (await db.all('agents')).filter((a) => a.ativo).sort((a, b) => (a.prioridade || 99) - (b.prioridade || 99));
  if (!ativos.length) return null;
  const t = text.toLowerCase();
  for (const a of ativos) {
    const gats = String(a.gatilhos || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (gats.length && gats.some((g) => g && t.includes(g))) return a;
  }
  // padrão: recepcionista (menor prioridade)
  return ativos[0];
}

async function saveAgentMessage(phone, reply) {
  const tel = normalizePhone(phone);
  let conv = (await db.query('conversas', (c) => c.telefone === tel))[0];
  if (!conv) conv = await db.insert('conversas', { telefone: tel, ultimoTexto: reply, naoLidas: 0 });
  else await db.update('conversas', conv.id, { ultimoTexto: reply });
  await db.insert('mensagens', { telefone: tel, direcao: 'out-agente', texto: reply });
}

// Motor principal: tenta resolver com agente. Retorna { handled, reply, agent, funcao }
export async function handleWithAgent({ phone, text, paciente, io, testMode }) {
  const agent = await matchAgent(text);
  if (!agent) return { handled: false };
  const intent = detectIntent(text);
  const permitidas = agent.funcoes || [];

  let funcao = permitidas.includes(intent) ? intent : null;
  let reply = null;
  let via = 'regras';

  // Se LLM configurado e modelo do agente != regras, deixa o LLM reescrever/rotear
  if (agent.modelo && agent.modelo !== 'regras') {
    const system = `${agent.prompt}\n\nFunções permitidas: ${permitidas.join(', ')}. Intenção detectada: ${intent}. Responda em até 3 frases curtas, pt-BR, com emoji moderado. Se precisar de dado do sistema, diga que vai verificar.`;
    const llm = await callLLM({ system, user: `Paciente (${phone}): ${text}` });
    if (llm) { reply = llm; via = `llm:${agent.modelo}`; }
  }

  if (!reply) {
    if (!funcao) {
      // fora do escopo do agente -> não trata, cai no menu antigo
      return { handled: false, agent, intent };
    }
    const out = await runFunction(funcao, { phone, text, paciente, io });
    reply = out.reply;
    funcao = out.funcao;
    if (out.transferir && !testMode) pausarBot(phone);
  }

  if (!testMode) {
    try {
      await db.insert('agent_runs', {
        agentId: agent.id, agentNome: agent.nome, telefone: normalizePhone(phone),
        entrada: text.slice(0, 300), intencao: intent, funcao: funcao || intent, via,
        resposta: (reply || '').slice(0, 500)
      });
    } catch {}
    await saveAgentMessage(phone, reply);
    io?.emit('mensagem:nova', { telefone: normalizePhone(phone), direcao: 'out-agente', texto: reply });
    await trySendText(normalizePhone(phone), reply);
  }
  return { handled: true, reply, agent, funcao: funcao || intent, via };
}

export { AGENT_FUNCTIONS };
