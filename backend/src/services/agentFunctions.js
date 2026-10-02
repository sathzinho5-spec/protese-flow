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

const PREÇOS = `💰 *Valores orientativos:*\n\n• Avaliação: GRATUITA\n• Prótese Total (dentadura): a partir de R$ 1.200\n• Prótese Parcial Removível: a partir de R$ 900\n• Ponte Fixa / Coroa: a partir de R$ 800\n• Overdenture sobre implante: a partir de R$ 3.500\n• Placa de bruxismo: a partir de R$ 400\n\nQuer agendar a avaliação gratuita? Digite *AGENDAR*.`;

function clinicaInfo() {
  return `📍 *${process.env.CLINICA_NOME || 'Clínica de Prótese Dentária'}*\n${process.env.CLINICA_ENDERECO || ''}\n🕐 ${process.env.CLINICA_HORARIO || ''}`;
}

// NLU simples por palavras-chave -> intenção
export function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(preço|preco|valor|quanto custa|orçamento|orcamento|tabela)/.test(t)) return 'consultar_valores';
  if (/(status|minha protese|como está|como esta|pronta|laborat[óo]rio|moldagem|prova)/.test(t)) return 'status_protese';
  if (/(agendar|marcar|avalia[çc][aã]o|consulta|hor[áa]rio)/.test(t)) return 'agendar_avaliacao';
  if (/^(confirmo|confirmar|confirmado|sim|vou sim|ok|presen[çc]a)/.test(t.trim())) return 'confirmar_presenca';
  if (/(remarcar|reagendar|cancelar|desmarcar|n[ãa]o vou|trocar)/.test(t)) return 'remarcar';
  if (/(endere[çc]o|onde fica|hor[áa]rio de|funcionamento|telefone|local)/.test(t)) return 'info_clinica';
  if (/(orçamento detalhado|orcamento detalhado|enviar orcamento|me manda o orcamento)/.test(t)) return 'enviar_orcamento';
  if (/(atendente|humano|falar com algu[ée]m|ajuda|socorro)/.test(t)) return 'transferir_humano';
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
      return { reply: PREÇOS, funcao: key };
    case 'info_clinica':
      return { reply: clinicaInfo(), funcao: key };
    case 'status_protese': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: '🔍 Não encontrei prótese no seu WhatsApp. Quer falar com atendente? Digite *ATENDENTE*.', funcao: key };
      const lista = prots.map((p) => `• *${p.tipo}* — ${p.status} (prev: ${p.previsao || 'a combinar'})`).join('\n');
      return { reply: `🦷 *Status da sua prótese:*\n${lista}`, funcao: key };
    }
    case 'agendar_avaliacao': {
      const { parseDataAgendamento } = await import('../utils/data.js');
      const dataTxt = extraiData(text) || 'a combinar';
      const ag = await db.insert('agendamentos', {
        pacienteId: paciente?.id, pacienteNome: paciente?.nome || 'Paciente WhatsApp',
        telefone: tel, data: dataTxt, dataISO: parseDataAgendamento(dataTxt) || undefined,
        motivo: text.slice(0, 120),
        status: 'pendente', origem: 'agente-ia'
      });
      io?.emit('agendamento:novo', { telefone: tel });
      return { reply: `✅ *Pré-agendamento registrado!* (${ag.data})\nNossa equipe confirma o horário aqui mesmo. Responda *CONFIRMO* quando receber a confirmação.`, funcao: key };
    }
    case 'confirmar_presenca': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && a.status === 'pendente')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!pend) return { reply: 'Não encontrei agendamento pendente no seu número. Quer agendar? Digite *AGENDAR*.', funcao: key };
      await db.update('agendamentos', pend.id, { status: 'confirmado' });
      io?.emit('agendamento:novo', { telefone: tel });
      return { reply: `✅ *Presença confirmada!* 🎉\n📅 ${pend.data}\nChegue com 10 min de antecedência.`, funcao: key };
    }
    case 'remarcar': {
      const pend = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === tel && ['pendente', 'confirmado'].includes(a.status))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (pend) await db.update('agendamentos', pend.id, { status: 'cancelado', motivoCancel: text });
      return { reply: '😔 Cancelei seu horário. Qual nova data prefere? (ex: 12/10 manhã)', funcao: key };
    }
    case 'enviar_orcamento': {
      const prots = await protesesDoTelefone(tel);
      if (!prots.length) return { reply: 'Ainda não há orçamento no seu número. Agende a avaliação gratuita: digite *AGENDAR*.', funcao: key };
      const p = prots[0];
      const texto = `🦷 *Orçamento*\n\n🔧 ${p.tipo}\n💰 R$ ${p.valor || 'a combinar'}\n📅 Previsão: ${p.previsao || 'a combinar'}\n\nBaixe o PDF: http://localhost:3001/api/proteses/${p.id}/orcamento.pdf`;
      return { reply: texto, funcao: key };
    }
    case 'transferir_humano':
      return { reply: '✅ Te transfiro para um atendente humano. Só um instante... 🙏', funcao: key, transferir: true };
    default:
      return { reply: null, funcao: 'desconhecida' };
  }
}

function extraiData(text) {
  const m = String(text).match(/(\d{1,2}\/\d{1,2})(\s+\d{1,2}h?)?(\s*(manh[ãa]|tarde|noite))?/);
  return m ? m[0] : null;
}

// Chamada LLM via Central de IAs (providers). Sem provedor ativo, retorna null -> regras.
export async function callLLM({ system, user }) {
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
        temperature: 0.3, max_tokens: 400
      }, { headers: { Authorization: `Bearer ${fallbackKey}` }, timeout: 20000 });
      return r.data.choices?.[0]?.message?.content?.trim() || null;
    }
    const out = await chatComplete({ system, user });
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
