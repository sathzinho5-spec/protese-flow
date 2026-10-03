import { db, normalizePhone, findPacienteByPhone, findConversaByPhone } from '../db.js';
import { trySendText } from './evolution.js';
import { getSession, setSession, retomarBot, pausarBot } from './sessions.js';
import { logger } from '../logger.js';

export { retomarBot, pausarBot };

const CLINICA_NOME = process.env.CLINICA_NOME || 'Clínica de Prótese Dentária';
const CLINICA_ENDERECO = process.env.CLINICA_ENDERECO || 'Rua das Flores, 123 - Centro';
const CLINICA_HORARIO = process.env.CLINICA_HORARIO || 'Seg a Sex 08h-18h, Sáb 08h-12h';

const MENU = `Oi! 😊 Aqui é da *${CLINICA_NOME}*. Como posso te ajudar hoje? Pode me contar com suas palavras.`;

const TABELA_PRECOS = 'O valor depende do tipo de prótese e da avaliação. A avaliação inicial é gratuita. Qual tipo você está procurando?';

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
    return reply(phone, `✅ *Presença confirmada!* 🎉\n\n📅 ${agPendente.data}\n🦷 ${agPendente.motivo || 'atendimento'}\n\nChegue com 10 min de antecedência. Se precisar remarcar, digite *REMARCAR*.`, io);
  }
  if (agPendente && /^(remarcar|reagendar|trocar|não vou|nao vou|cancelar|cancela|desmarcar)/i.test(text.trim())) {
    await db.update('agendamentos', agPendente.id, { status: 'cancelado', motivoCancel: text });
    try { await db.insert('logs', { autor: 'bot-whatsapp', acao: 'cancelar_agendamento', entidade: 'agendamentos', entidadeId: agPendente.id, detalhe: `${agPendente.pacienteNome}: ${text}` }); } catch {}
    io?.emit('agendamento:novo', { telefone: phone, auto: 'cancelado' });
    await setSession(phone, { step: 'ag_data', data: { nome: agPendente.pacienteNome } });
    return reply(phone, `😔 Entendi, cancelei o horário de *${agPendente.data}*.\n\n📅 Qual nova data prefere? (ex: 12/10 manhã)`, io);
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
      return reply(phone, `Obrigado, ${text}! 📅 Qual data prefere? (ex: 10/10 manhã ou 11/10 tarde)`, io);
    case 'ag_data':
      await setSession(phone, { step: 'ag_periodo', data: { ...session.data, dataPref: text } });
      return reply(phone, 'Anotado! 📝 Qual o motivo? Ex: *dentadura quebrada, avaliação, prótese nova, ajuste, implante*', io);
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
      return reply(phone, `✅ *Pré-agendamento registrado!*\n\n👤 ${data.nome || paciente.nome}\n📅 ${data.dataPref}\n🦷 Motivo: ${data.motivo}\n\nNossa equipe vai confirmar o horário aqui mesmo. Obrigado! 😁\n\nDigite *menu* para voltar.`, io);
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
      return reply(phone, `Olá ${pac.nome}! 📅 Qual data prefere? (ex: 10/10 manhã)`, io);
    }
    await setSession(phone, { step: 'ag_nome' });
    return reply(phone, 'Ótimo! Para agendar sua *avaliação gratuita* 🦷\nQual seu nome completo?', io);
  }
  if (t === '2') return reply(phone, TABELA_PRECOS, io);
  if (t === '3') {
    const proteses = await db.query('proteses', () => true);
    const minhas = [];
    for (const pr of proteses) {
      const pac = pr.pacienteId ? await db.find('pacientes', pr.pacienteId) : null;
      if (pac && normalizePhone(pac.telefone) === phone) minhas.push(pr);
    }
    if (!minhas.length) return reply(phone, '🔍 Não encontrei prótese vinculada ao seu WhatsApp.\nDigite *4* para falar com atendente.', io);
    const lista = minhas.map((p) => `• *${p.tipo}* — ${p.status} (prev: ${p.previsao || 'a combinar'})`).join('\n');
    return reply(phone, `🦷 *Status da sua prótese:*\n${lista}\n\nDigite *menu* para voltar.`, io);
  }
  if (t === '4') {
    await setSession(phone, { botAtivo: false });
    return reply(phone, '✅ Chamando atendente humano... Já já te respondemos aqui! 🙏', io);
  }
  if (t === '5') {
    return reply(phone, `📍 *${CLINICA_NOME}*\n${CLINICA_ENDERECO}\n🕐 ${CLINICA_HORARIO}\n\nDigite *menu* para voltar ou *1* para agendar.`, io);
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
