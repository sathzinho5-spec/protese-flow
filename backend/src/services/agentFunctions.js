import { db, normalizePhone } from '../db.js';
import { logger } from '../logger.js';

// Catálogo de funções que um agente pode executar no WhatsApp
export const AGENT_FUNCTIONS = [
  { key: 'consultar_valores', nome: 'Consultar valores', descricao: 'Informa tabela de preços de próteses' },
  { key: 'status_protese', nome: 'Status da prótese', descricao: 'Busca próteses vinculadas ao telefone' },
  { key: 'agendar_avaliacao', nome: 'Agendar avaliação', descricao: 'Cria pré-agendamento pendente' },
  { key: 'confirmar_presenca', nome: 'Confirmar presença', descricao: 'Confirma agendamento pendente (CONFIRMO)' },
  { key: 'remarcar', nome: 'Remarcar / cancelar', descricao: 'Cancela horário e pede nova data' },
  { key: 'info_clinica', nome: 'Info da clínica', descricao: 'Endereço, horários, telefone' },
  { key: 'enviar_orcamento', nome: 'Enviar orçamento', descricao: 'Envia orçamento da prótese no WhatsApp' },
  { key: 'transferir_humano', nome: 'Transferir p/ humano', descricao: 'Pausa o bot e chama atendente' },
];

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function respostaValor(text) {
  const t = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const valores = [
    { match: /overdenture|protese sobre implante/, nome: 'Overdenture sobre implante', valor: 'R$ 3.500' },
    { match: /protese parcial|parcial removivel/, nome: 'Prótese parcial removível', valor: 'R$ 900' },
    { match: /dentadura|protese total/, nome: 'Prótese total', valor: 'R$ 1.200' },
    { match: /ponte fixa|coroa/, nome: 'Ponte fixa ou coroa', valor: 'R$ 800' },
    { match: /placa de bruxismo|bruxismo/, nome: 'Placa para bruxismo', valor: 'R$ 400' },
  ];
  const item = valores.find((v) => v.match.test(t));
  if (!item) return 'O valor depende do tipo de prótese e da avaliação. A avaliação inicial é gratuita. Qual tipo você está procurando?';
  return `A ${item.nome.toLowerCase()} começa em ${item.valor}. O valor final é definido após a avaliação, que é gratuita.`;
}

function clinicaInfo() {
  return `📍 *${process.env.CLINICA_NOME || 'Clínica de Prótese Dentária'}*\n${process.env.CLINICA_ENDERECO || ''}\n🕐 ${process.env.CLINICA_HORARIO || ''}`;
}

// NLU simples por palavras-chave -> intenção
export function detectIntent(text) {
  const t = normalizeText(text);
  if (/(dor forte|inchad|sangr|febre|urgente|emergencia|dificuldade para respirar)/.test(t)) return 'transferir_humano';
  if (/(orcamento detalhado|enviar orcamento|me manda o orcamento)/.test(t)) return 'enviar_orcamento';
  if (/(preco|valor|quanto custa|orcamento|tabela|quanto fica|custa)/.test(t)) return 'consultar_valores';
  if (/(status|minha protese|como esta|pronta|laboratorio|moldagem|prova)/.test(t)) return 'status_protese';
  if (/^(confirmo|confirmar|confirmado|sim|vou sim|ok|presenca)/.test(t)) return 'confirmar_presenca';
  if (/(remarcar|reagendar|cancelar|desmarcar|nao vou|trocar)/.test(t)) return 'remarcar';
  if (/(agendar|marcar|avaliacao|consulta|horario)/.test(t)) return 'agendar_avaliacao';
  if (/(endereco|onde fica|horario de|funcionamento|telefone|local)/.test(t)) return 'info_clinica';
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
      return { reply: clinicaInfo(), funcao: key };
    case 'status_protese': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: 'Não localizei uma prótese vinculada a este número. Posso pedir para a equipe conferir.', funcao: key };
      const lista = prots.map((p) => `• *${p.tipo}* — ${p.status} (prev: ${p.previsao || 'a combinar'})`).join('\n');
      return { reply: `Consultei aqui: ${lista}. Se quiser, posso chamar a equipe para explicar os próximos passos.`, funcao: key };
    }
    case 'agendar_avaliacao': {
      const nome = paciente?.nome && paciente.nome !== 'Paciente' ? paciente.nome : '';
      await (await import('./sessions.js')).setSession(phone, {
        step: nome ? 'ag_data' : 'ag_nome',
        data: nome ? { nome } : {},
      });
      return {
        reply: nome
          ? `Claro, ${nome}. Qual dia e período ficam melhores para sua avaliação?`
          : 'Claro. Qual nome posso informar para a equipe ao pedir sua avaliação?',
        funcao: key,
      };
    }
    case 'confirmar_presenca': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && a.status === 'pendente')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!pend) return { reply: 'Não encontrei um agendamento pendente neste número. Quer que eu peça para a equipe conferir?', funcao: key };
      await db.update('agendamentos', pend.id, { status: 'confirmado' });
      io?.emit('agendamento:novo', { telefone: tel });
      return { reply: `Presença confirmada para ${pend.data}. A equipe avisa por aqui se houver alguma orientação adicional.`, funcao: key };
    }
    case 'remarcar': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && ['pendente', 'confirmado'].includes(a.status))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!pend) return { reply: 'Não encontrei um horário ativo para remarcar. Posso encaminhar sua conversa para a equipe.', funcao: key };
      await db.update('agendamentos', pend.id, { status: 'cancelado', motivoCancel: text });
      await (await import('./sessions.js')).setSession(phone, { step: 'ag_data', data: { nome: pend.pacienteNome || paciente?.nome || '' } });
      return { reply: `Certo, cancelei o horário de ${pend.data}. Para qual dia e período você gostaria de remarcar?`, funcao: key };
    }
    case 'enviar_orcamento': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: 'Ainda não há orçamento no seu número. Agende a avaliação gratuita: digite *AGENDAR*.', funcao: key };
      const p = prots[0];
      const texto = `🦷 *Orçamento*\n\n🔧 ${p.tipo}\n💰 R$ ${p.valor || 'a combinar'}\n📅 Previsão: ${p.previsao || 'a combinar'}\n\nBaixe o PDF: http://localhost:3001/api/proteses/${p.id}/orcamento.pdf`;
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
  if ((await db.all('agents')).length) return;
  const base = [
    {
      nome: 'Recepcionista — Triagem', descricao: 'Saúda, entende o motivo e direciona',
      prompt: 'Você é a recepcionista da clínica de prótese dentária. Seja cordial, objetiva, use emojis moderados. Sempre ofereça: agendar avaliação gratuita, informar valores, status da prótese ou chamar humano. Nunca invente valores fora da tabela. Se não entender, ofereça o menu.',
      funcoes: ['consultar_valores', 'status_protese', 'agendar_avaliacao', 'info_clinica', 'transferir_humano'],
      gatilhos: '', prioridade: 10, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Agendador', descricao: 'Foca em marcar, confirmar e remarcar',
      prompt: 'Você é o agendador. Objetivo: converter conversa em agendamento confirmado. Peça nome, data e motivo. Confirme com resumo. Aceite CONFIRMO e REMARCAR a qualquer momento.',
      funcoes: ['agendar_avaliacao', 'confirmar_presenca', 'remarcar', 'info_clinica', 'transferir_humano'],
      gatilhos: 'agendar, marcar, horário, consulta, confirmo, remarcar', prioridade: 20, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Financeiro — Cobrança gentil', descricao: 'Orçamentos, entradas e recibos',
      prompt: 'Você é do financeiro. Tom gentil, nunca constrangedor. Informe valores, saldo, formas (pix/dinheiro/cartão). Ofereça enviar orçamento em PDF e recibo. Não dê desconto sem humano.',
      funcoes: ['consultar_valores', 'enviar_orcamento', 'status_protese', 'transferir_humano'],
      gatilhos: 'preço, valor, orçamento, pagamento, pix, recibo, boleto', prioridade: 30, ativo: true, modelo: 'regras'
    },
    {
      nome: 'Pós-entrega', descricao: 'Ajustes, revisões e garantia',
      prompt: 'Você cuida do pós-entrega. Pergunte sobre adaptação, ofereça ajuste gratuito em 7 dias, revisão de 30 dias e lembre da garantia de 12 meses.',
      funcoes: ['status_protese', 'agendar_avaliacao', 'info_clinica', 'transferir_humano'],
      gatilhos: 'ajuste, incomodando, machucando, garantia, revisão, manutenção', prioridade: 40, ativo: true, modelo: 'regras'
    }
  ];
  for (const a of base) await db.insert('agents', a);
}
