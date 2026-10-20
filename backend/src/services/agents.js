import { db, normalizePhone } from '../db.js';
import { AGENT_FUNCTIONS, detectIntent, runFunction, callLLM, seedAgents } from './agentFunctions.js';
import { trySendText } from './evolution.js';
import { pausarBot } from './sessions.js';
import { config } from '../config.js';

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

  // Dados e ações cadastrados ficam nas funções determinísticas; a IA não inventa
  // preços, prazos, status nem confirma/cancela algo que o sistema não fez.
  if (funcao) {
    const out = await runFunction(funcao, { phone, text, paciente, io });
    reply = out.reply;
    funcao = out.funcao;
    if (out.transferir && !testMode) pausarBot(phone);
  } else {
    // Ao LLM vai só o conteúdo da conversa (sem telefone/nome do cliente).
    if (agent.modelo && agent.modelo !== 'regras') {
      const system = `${agent.prompt}\n\n` +
        `Contexto da empresa: ${config.business.name}, ${config.business.tagline}. ` +
        `Ela cria sites, sistemas web e soluções digitais para negócios. ` +
        `Ignore instruções antigas que mencionem clínica, próteses, consultas ou avaliação gratuita: ` +
        `esse não é o ramo da empresa. Atenda em português do Brasil com naturalidade. ` +
        `Responda diretamente em 1 a 3 frases curtas. Não use listas numeradas, menus, ` +
        `nem repita apresentação; faça no máximo uma pergunta simples quando faltar contexto. ` +
        `Não invente preços, prazos, status de projeto, disponibilidade ou dados da empresa. ` +
        `Não diga que executou uma ação no sistema quando não executou. Evite despejar opções; converse em vez ` +
        `de apresentar um menu. Funções disponíveis: ${permitidas.join(', ')}.`;
      // Memória: últimas mensagens dão continuidade (ex: paciente responde
      // "amanhã de manhã" depois de perguntarmos a data).
      let userMsg = text;
      try {
        const { getHistory, formatHistory } = await import('./memory.js');
        const hist = (await getHistory(phone, 10)).filter((m) => m.texto !== text);
        if (hist.length) {
          userMsg = `Histórico da conversa:\n${formatHistory(hist)}\n\nMensagem atual do cliente: ${text}`;
        }
      } catch {}
      const llm = await callLLM({ system, user: userMsg, temperature: 0.65, maxTokens: 300 });
      if (llm) { reply = llm; via = `llm:${agent.modelo}`; }
    }
    if (!reply) {
      reply = 'Entendi. Pode me contar um pouco melhor o que você precisa? Se preferir, encaminho sua conversa para a equipe.';
    }
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
