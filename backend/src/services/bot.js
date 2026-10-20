import { db, normalizePhone, findPacienteByPhone, findConversaByPhone } from '../db.js';
import { trySendText } from './evolution.js';
import { getSession, setSession, retomarBot, pausarBot } from './sessions.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

export { retomarBot, pausarBot };

const MENU = `Oi! Aqui é da *${config.business.name}*. Como posso ajudar com seu site, sistema ou projeto digital?`;
const SOBRE_VALORES = 'O investimento depende do escopo e dos recursos necessários. Se me contar o que seu negócio precisa, a equipe prepara uma proposta adequada.';

export async function handleIncoming({ phone, text, pushName, io }) {
  phone = normalizePhone(phone);
  const lower = text.toLowerCase();

  let paciente = await findPacienteByPhone(phone);
  if (!paciente) {
    paciente = await db.insert('pacientes', { nome: pushName, telefone: phone, origem: 'whatsapp' });
  }

  await saveMessage(phone, 'in', text);

  const session = await getSession(phone);
  if (!session.botAtivo) {
    emitMsg(io, phone, 'in', text);
    return;
  }

  // 1) Confirmação / cancelamento automático (vale em qualquer etapa)
  const agPendente = (await db.query('agendamentos', (a) => normalizePhone(a.telefone) === phone && a.status === 'pendente'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (agPendente && /^(confirmo|confirmar|confirmado|sim|pode confirmar|ok pode|vou sim|presença|presenca)/i.test(text.trim())) {
    await db.update('agendamentos', agPendente.id, { status: 'confirmado' });
    try { await db.insert('logs', { autor: 'bot-whatsapp', acao: 'confirmar_agendamento', entidade: 'agendamentos', entidadeId: agPendente.id, detalhe: `${agPendente.pacienteNome} confirmou via WhatsApp` }); } catch {}
    io?.emit('agendamento:novo', { telefone: phone, auto: 'confirmado' });
    await setSession(phone, { step: 'menu', data: {} });
    return reply(phone, `Compromisso confirmado para ${agPendente.data}. Se precisar alterar, é só avisar por aqui.`, io);
  }
  if (agPendente && /^(remarcar|reagendar|trocar|não vou|nao vou|cancelar|cancela|desmarcar)/i.test(text.trim())) {
    await db.update('agendamentos', agPendente.id, { status: 'cancelado', motivoCancel: text });
    try { await db.insert('logs', { autor: 'bot-whatsapp', acao: 'cancelar_agendamento', entidade: 'agendamentos', entidadeId: agPendente.id, detalhe: `${agPendente.pacienteNome}: ${text}` }); } catch {}
    io?.emit('agendamento:novo', { telefone: phone, auto: 'cancelado' });
    await setSession(phone, { step: 'ag_data', data: { nome: agPendente.pacienteNome } });
      return reply(phone, `Cancelei o compromisso de ${agPendente.data}. Qual dia e período seriam melhores para remarcar?`, io);
  }

  if (['menu', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'início', 'inicio'].includes(lower)) {
    await setSession(phone, { step: 'menu', data: {} });
    return reply(phone, MENU, io);
  }
  // Mantém os atalhos antigos para quem já aprendeu a usar 1–5.
  if (session.step === 'menu' && /^[1-5]$/.test(lower)) return handleMenu(phone, text, io);
  if (lower === 'atendente' || text === '4') {
    await setSession(phone, { botAtivo: false });
    return reply(phone, '✅ Te transfiro para um atendente humano. Só um instante... 🙏\n(Um atendente vai responder aqui mesmo em instantes)', io);
  }

  // 🤖 Agentes (prompt + funções) antes do menu legado
  if (session.step === 'menu') {
    try {
      const { handleWithAgent } = await import('./agents.js');
      const r = await handleWithAgent({ phone, text, paciente, io });
      if (r.handled) {
        try { await db.insert('logs', { autor: `agente:${r.agent.nome}`, acao: 'agente_respondeu', entidade: 'conversas', entidadeId: phone, detalhe: `${r.funcao} via ${r.via}` }); } catch {}
        return;
      }
    } catch (e) { logger.warn('[agents] falha, caindo p/ menu:', e.message); }
  }

  switch (session.step) {
    case 'menu':
      return handleMenu(phone, text, io);
    case 'ag_nome':
      await setSession(phone, { step: 'ag_data', data: { ...session.data, nome: text } });
      return reply(phone, `Obrigado, ${text}. Qual dia e período são melhores para uma conversa com a equipe?`, io);
    case 'ag_data':
      await setSession(phone, { step: 'ag_periodo', data: { ...session.data, dataPref: text } });
      return reply(phone, 'Anotado. Qual assunto ou projeto você gostaria de conversar com a equipe?', io);
    case 'ag_periodo': {
      const data = { ...session.data, motivo: text };
      const { parseDataAgendamento } = await import('../utils/data.js');
      await db.insert('agendamentos', {
        pacienteId: paciente.id,
        pacienteNome: data.nome || paciente.nome,
        telefone: phone,
        data: data.dataPref,
        dataISO: parseDataAgendamento(data.dataPref) || undefined,
        motivo: data.motivo,
        status: 'pendente',
        origem: 'bot-whatsapp'
      });
      await setSession(phone, { step: 'menu', data: {} });
      io?.emit('agendamento:novo', { telefone: phone, motivo: text });
      return reply(phone, `Anotei seu pedido de conversa para ${data.dataPref}, sobre ${data.motivo}. A equipe vai confirmar a disponibilidade por aqui.`, io);
    }
    default:
      return reply(phone, MENU, io);
  }
}

async function handleMenu(phone, text, io) {
  const t = text.trim();
  if (t === '1') {
    const pac = await findPacienteByPhone(phone);
    if (pac?.nome && pac.nome !== 'Paciente') {
      await setSession(phone, { step: 'ag_data', data: { nome: pac.nome } });
      return reply(phone, `Olá, ${pac.nome}! Qual dia e período são melhores para conversar com a equipe?`, io);
    }
    await setSession(phone, { step: 'ag_nome' });
    return reply(phone, 'Claro. Qual nome posso informar para a equipe organizar uma conversa?', io);
  }
  if (t === '2') return reply(phone, SOBRE_VALORES, io);
  if (t === '3') {
    const proteses = await db.query('proteses', () => true);
    const minhas = [];
    for (const pr of proteses) {
      const pac = pr.pacienteId ? await db.find('pacientes', pr.pacienteId) : null;
      if (pac && normalizePhone(pac.telefone) === phone) minhas.push(pr);
    }
    if (!minhas.length) return reply(phone, 'Não encontrei um projeto vinculado a este WhatsApp. Posso pedir para a equipe conferir.', io);
    const lista = minhas.map((p) => `• *${p.tipo}* — ${p.status} (prev: ${p.previsao || 'a combinar'})`).join('\n');
    return reply(phone, `Consultei o andamento do seu projeto:\n${lista}`, io);
  }
  if (t === '4') {
    await setSession(phone, { botAtivo: false });
    return reply(phone, '✅ Chamando atendente humano... Já já te respondemos aqui! 🙏', io);
  }
  if (t === '5') {
    const info = [config.business.name, config.business.tagline, config.business.address, config.business.hours].filter(Boolean).join('\n');
    return reply(phone, info, io);
  }
  return reply(phone, 'Não entendi muito bem. Pode me explicar de outro jeito? Se preferir, encaminho você para a equipe.', io);
}

async function reply(phone, text, io) {
  await saveMessage(phone, 'out-bot', text);
  emitMsg(io, phone, 'out-bot', text);
  await trySendText(phone, text); // resiliente: falha só loga, mensagem já salva
}

async function saveMessage(phone, dir, text) {
  let conv = await findConversaByPhone(phone);
  if (!conv) conv = await db.insert('conversas', { telefone: phone, ultimoTexto: text, naoLidas: 0 });
  await db.update('conversas', conv.id, {
    ultimoTexto: text,
    naoLidas: dir === 'in' ? (conv.naoLidas || 0) + 1 : conv.naoLidas
  });
  await db.insert('mensagens', { telefone: phone, direcao: dir, texto: text });
}

function emitMsg(io, phone, direcao, texto) {
  io?.emit('mensagem:nova', { telefone: phone, direcao, texto, createdAt: new Date().toISOString() });
}
