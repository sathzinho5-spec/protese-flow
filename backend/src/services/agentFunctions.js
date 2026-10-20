import { db, normalizePhone } from '../db.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

// Catálogo de funções que um agente pode executar no WhatsApp
export const AGENT_FUNCTIONS = [
  { key: 'consultar_valores', nome: 'Consultar valores', descricao: 'Orienta sobre valores e elaboração de propostas' },
  { key: 'status_protese', nome: 'Status do projeto', descricao: 'Consulta projetos vinculados ao contato' },
  { key: 'agendar_avaliacao', nome: 'Agendar conversa', descricao: 'Registra solicitação de reunião' },
  { key: 'confirmar_presenca', nome: 'Confirmar compromisso', descricao: 'Confirma reunião ou compromisso pendente' },
  { key: 'remarcar', nome: 'Remarcar / cancelar', descricao: 'Altera ou cancela um compromisso' },
  { key: 'info_clinica', nome: 'Informações da empresa', descricao: 'Nome, serviços, localização e horários' },
  { key: 'enviar_orcamento', nome: 'Enviar proposta', descricao: 'Compartilha os dados da proposta do projeto' },
  { key: 'transferir_humano', nome: 'Transferir p/ humano', descricao: 'Pausa o bot e chama atendente' },
];

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function respostaValor(text) {
  const services = config.business.services;
  const lista = services.length ? ` Trabalhamos com ${services.join(', ')}.` : '';
  return `O valor depende do escopo e dos recursos do projeto.${lista} Se me contar o que você precisa, a equipe prepara uma proposta adequada.`;
}

function empresaInfo() {
  const lines = [`*${config.business.name}*`, config.business.tagline];
  if (config.business.address) lines.push(`📍 ${config.business.address}`);
  if (config.business.hours) lines.push(`🕐 ${config.business.hours}`);
  if (config.business.services.length) lines.push(`Serviços: ${config.business.services.join(', ')}.`);
  return lines.filter(Boolean).join('\n');
}

// NLU simples por palavras-chave -> intenção
export function detectIntent(text) {
  const t = normalizeText(text);
  if (/(proposta|orcamento detalhado|enviar orcamento|me manda o orcamento)/.test(t)) return 'enviar_orcamento';
  if (/(preco|valor|quanto custa|orcamento|tabela|quanto fica|custa|investimento)/.test(t)) return 'consultar_valores';
  if (/(status|meu projeto|meu site|como esta|andamento|entrega|desenvolvimento)/.test(t)) return 'status_protese';
  if (/^(confirmo|confirmar|confirmado|sim|vou sim|ok|presenca)/.test(t)) return 'confirmar_presenca';
  if (/(remarcar|reagendar|cancelar|desmarcar|nao vou|trocar)/.test(t)) return 'remarcar';
  if (/(agendar|marcar|reuniao|conversa|demonstracao|call|horario)/.test(t)) return 'agendar_avaliacao';
  if (/(endereco|onde fica|horario de|funcionamento|telefone|local|servicos|quem e|o que voces fazem|quais solucoes|fazem site)/.test(t)) return 'info_clinica';
  if (/(atendente|humano|falar com alguem|ajuda|socorro)/.test(t)) return 'transferir_humano';
  return 'desconhecida';
}

async function protesesDoTelefone(tel) {
  const out = [];
  for (const pr of await db.query('proteses', () => true)) {
    const pac = pr.pacienteId ? await db.find('pacientes', pr.pacienteId) : null;
    if (pac && normalizePhone(pac.telefone) === tel) out.push(pr);
  }
  return out;
}

export async function runFunction(key, ctx) {
  const { phone, text, paciente, io } = ctx;
  const tel = normalizePhone(phone);
  switch (key) {
    case 'consultar_valores':
      return { reply: respostaValor(text), funcao: key };
    case 'info_clinica':
      return { reply: empresaInfo(), funcao: key };
    case 'status_protese': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: 'Não encontrei um projeto vinculado a este WhatsApp. Posso pedir para a equipe conferir.', funcao: key };
      const lista = prots.map((p) => `• *${p.tipo}* — ${p.status} (previsão: ${p.previsao || 'a combinar'})`).join('\n');
      return { reply: `Consultei o andamento do seu projeto:\n${lista}\nSe precisar, a equipe pode explicar a próxima etapa.`, funcao: key };
    }
    case 'agendar_avaliacao': {
      const nome = paciente?.nome && paciente.nome !== 'Paciente' ? paciente.nome : '';
      await (await import('./sessions.js')).setSession(phone, {
        step: nome ? 'ag_data' : 'ag_nome',
        data: nome ? { nome } : {},
      });
      return {
        reply: nome
          ? `Claro, ${nome}. Qual dia e período ficam melhores para uma conversa com a equipe?`
          : 'Claro. Qual nome posso informar para a equipe organizar esse contato?',
        funcao: key,
      };
    }
    case 'confirmar_presenca': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && a.status === 'pendente')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!pend) return { reply: 'Não encontrei um compromisso pendente neste número. Quer que eu peça para a equipe conferir?', funcao: key };
      await db.update('agendamentos', pend.id, { status: 'confirmado' });
      io?.emit('agendamento:novo', { telefone: tel });
      return { reply: `Presença confirmada para ${pend.data}. A equipe avisa por aqui se houver alguma orientação adicional.`, funcao: key };
    }
    case 'remarcar': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && ['pendente', 'confirmado'].includes(a.status))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!pend) return { reply: 'Não encontrei um compromisso ativo para remarcar. Posso encaminhar sua conversa para a equipe.', funcao: key };
      await db.update('agendamentos', pend.id, { status: 'cancelado', motivoCancel: text });
      await (await import('./sessions.js')).setSession(phone, { step: 'ag_data', data: { nome: pend.pacienteNome || paciente?.nome || '' } });
      return { reply: `Certo, cancelei o horário de ${pend.data}. Para qual dia e período você gostaria de remarcar?`, funcao: key };
    }
    case 'enviar_orcamento': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: 'Ainda não encontrei uma proposta vinculada ao seu número. Vou pedir para a equipe verificar.', funcao: key };
      const p = prots[0];
      const texto = `*Proposta — ${config.business.name}*\n\nProjeto: ${p.tipo}\nInvestimento: R$ ${p.valor || 'a combinar'}\nPrevisão: ${p.previsao || 'a combinar'}\n\nA equipe pode encaminhar o documento completo por aqui.`;
      return { reply: texto, funcao: key };
    }
    case 'transferir_humano':
      return { reply: 'Vou encaminhar sua conversa para a equipe. Assim que alguém estiver disponível, responde por aqui.', funcao: key, transferir: true };
    default:
      return { reply: null, funcao: 'desconhecida' };
  }
}

// Chamada LLM via Central de IAs (providers). Sem provedor ativo, retorna null -> regras.
export async function callLLM({ system, user, temperature = 0.65, maxTokens = 300 }) {
  try {
    const { chatComplete, defaultProvider } = await import('./ai.js');
    const prov = await defaultProvider();
    const fallbackKey = process.env.OPENAI_API_KEY;
    if (!prov && !fallbackKey) return null;
    if (!prov && fallbackKey) {
      const { default: axios } = await import('axios');
      const r = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature, max_tokens: maxTokens
      }, { headers: { Authorization: `Bearer ${fallbackKey}` }, timeout: 20000 });
      return r.data.choices?.[0]?.message?.content?.trim() || null;
    }
    const out = await chatComplete({ system, user, temperature, maxTokens });
    return out?.text || null;
  } catch (e) {
    logger.warn('[agents][llm] falha:', e.response?.data || e.message);
    return null;
  }
}

export async function seedAgents() {
  const existentes = await db.all('agents');
  if (existentes.length) {
    // Migra apenas prompts padrão antigos intactos; não sobrescreve customizações.
    const migrations = new Map([
      ['Você é a recepcionista da clínica de prótese dentária. Seja cordial, objetiva, use emojis moderados. Sempre ofereça: agendar avaliação gratuita, informar valores, status da prótese ou chamar humano. Nunca invente valores fora da tabela. Se não entender, ofereça o menu.', 'Você atende clientes da Seth Digital. Seja cordial, natural e objetiva. Entenda o que a pessoa quer criar ou melhorar; faça uma pergunta de cada vez. Não invente preços, prazos ou recursos e nunca prometa serviços gratuitos.'],
      ['Você é o agendador. Objetivo: converter conversa em agendamento confirmado. Peça nome, data e motivo. Confirme com resumo. Aceite CONFIRMO e REMARCAR a qualquer momento.', 'Ajude a organizar uma conversa com a equipe. Peça nome, melhor dia e horário e o assunto. Não confirme um horário até a equipe validar. Aceite CONFIRMO e REMARCAR para compromissos existentes.'],
      ['Você é do financeiro. Tom gentil, nunca constrangedor. Informe valores, saldo, formas (pix/dinheiro/cartão). Ofereça enviar orçamento em PDF e recibo. Não dê desconto sem humano.', 'Atenda dúvidas comerciais com clareza e respeito. Consulte os valores cadastrados e não invente preço, prazo, desconto ou condição de pagamento. Encaminhe negociações específicas para a equipe.'],
      ['Você cuida do pós-entrega. Pergunte sobre adaptação, ofereça ajuste gratuito em 7 dias, revisão de 30 dias e lembre da garantia de 12 meses.', 'Acompanhe clientes após a entrega de sites e sistemas. Seja prestativo, registre problemas e encaminhe solicitações técnicas para a equipe. Não prometa prazos ou suporte gratuito sem confirmação.']
    ]);
    const nomes = {
      'Recepcionista — Triagem': 'Atendimento — Triagem',
      Agendador: 'Agenda',
      'Financeiro — Cobrança gentil': 'Comercial e propostas',
      'Pós-entrega': 'Pós-venda'
    };
    for (const a of existentes) if (migrations.has(a.prompt)) {
      await db.update('agents', a.id, { prompt: migrations.get(a.prompt), nome: nomes[a.nome] || a.nome });
    }
    return;
  }
  const base = [
    {
      nome: 'Atendimento — Triagem', descricao: 'Entende a necessidade e direciona o contato',
      prompt: 'Você atende clientes da Seth Digital. Seja cordial, natural e objetiva. Entenda o que a pessoa quer criar ou melhorar; faça uma pergunta de cada vez. Não invente preços, prazos ou recursos e não ofereça serviços gratuitos sem confirmação.',
      funcoes: ['consultar_valores', 'status_protese', 'agendar_avaliacao', 'info_clinica', 'transferir_humano'],
      gatilhos: '', prioridade: 10, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Agenda', descricao: 'Organiza reuniões e confirmações',
      prompt: 'Ajude a organizar uma conversa com a equipe. Peça nome, melhor dia e horário e o assunto. Não confirme até a equipe validar. Aceite CONFIRMO e REMARCAR para compromissos existentes.',
      funcoes: ['agendar_avaliacao', 'confirmar_presenca', 'remarcar', 'info_clinica', 'transferir_humano'],
      gatilhos: 'agendar, marcar, horário, consulta, confirmo, remarcar', prioridade: 20, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Comercial e propostas', descricao: 'Explica propostas, pagamentos e recibos',
      prompt: 'Atenda dúvidas comerciais com clareza e respeito. Consulte os valores cadastrados e não invente preço, prazo, desconto ou condição de pagamento. Encaminhe negociações específicas para a equipe.',
      funcoes: ['consultar_valores', 'enviar_orcamento', 'status_protese', 'transferir_humano'],
      gatilhos: 'preço, valor, orçamento, pagamento, pix, recibo, boleto', prioridade: 30, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Pós-venda', descricao: 'Acompanha projetos entregues e novas solicitações',
      prompt: 'Acompanhe clientes após a entrega de sites e sistemas. Seja prestativo, registre problemas e encaminhe solicitações técnicas para a equipe. Não prometa prazos ou suporte gratuito sem confirmação.',
      funcoes: ['status_protese', 'agendar_avaliacao', 'info_clinica', 'transferir_humano'],
      gatilhos: 'ajuste, incomodando, machucando, garantia, revisão, manutenção', prioridade: 40, ativo: true, modelo: 'regras'
    }
  ];
  for (const a of base) await db.insert('agents', a);
}
