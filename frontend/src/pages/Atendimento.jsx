import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useSocket } from '../hooks.js';
import { initials, toast } from '../components/ui.jsx';

export default function Atendimento() {
  const [conversas, setConversas] = useState([]);
  const [busca, setBusca] = useState('');
  const [tel, setTel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [detalhe, setDetalhe] = useState({ paciente: null, proteses: [] });
  const telRef = useRef(tel);
  telRef.current = tel;

  const carregarConvs = useCallback(() => api.get('/api/conversas').then(r => setConversas(r.data)).catch(() => {}), []);
  const carregarMsgs = useCallback((telefone) => {
    if (!telefone) return;
    api.get(`/api/conversas/${telefone}/mensagens`).then(r => setMsgs(r.data)).catch(() => {});
    api.post(`/api/conversas/${telefone}/ler`).then(carregarConvs).catch(() => {});
    api.get('/api/pacientes').then(r => {
      const pac = r.data.find(p => String(p.telefone).replace(/\D/g, '') === String(telefone).replace(/\D/g, ''));
      if (pac) {
        api.get('/api/proteses').then(pr => setDetalhe({ paciente: pac, proteses: pr.data.filter(x => x.pacienteId === pac.id) })).catch(() => {});
      } else setDetalhe({ paciente: null, proteses: [] });
    }).catch(() => {});
  }, [carregarConvs]);

  useEffect(() => { carregarConvs(); }, [carregarConvs]);
  useSocket(['mensagem:nova', 'conversas:update'], () => { carregarConvs(); if (telRef.current) carregarMsgs(telRef.current); });

  const select = (telefone) => { setTel(telefone); carregarMsgs(telefone); };

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !tel) return;
    try {
      const r = await api.post(`/api/conversas/${tel}/enviar`, { texto });
      setTexto('');
      carregarMsgs(tel);
      if (r.data?.enviado === false) toast('WhatsApp fora do ar — mensagem salva como pendente', 'erro');
    } catch (err) { toast(err.response?.data?.error || 'Falha ao enviar', 'erro'); }
  };

  const bot = async (ativo) => {
    try {
      await api.post(`/api/conversas/${tel}/bot`, { ativo });
      toast(ativo ? 'Bot retomado 🤖' : 'Bot pausado — você assumiu 👩‍⚕️');
    } catch (err) { toast(err.response?.data?.error || 'Falha', 'erro'); }
  };

  const filtradas = conversas.filter(c =>
    !busca || (c.pacienteNome || c.telefone).toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  );
  const atual = conversas.find(c => String(c.telefone) === String(tel));

  return (
    <div className={`wa-layout ${tel ? 'has-conversation' : ''}`}>
      <div className="conv-list">
        <header>
          <strong>Conversas</strong> <span className="muted small">{filtradas.length}</span>
          <input placeholder="🔍 Buscar paciente ou número..." value={busca} onChange={e => setBusca(e.target.value)} />
        </header>
        <div className="convs">
          {filtradas.map(c => (
            <div key={c.id} onClick={() => select(c.telefone)} className={`conv ${String(tel) === String(c.telefone) ? 'active' : ''}`}>
              <div className="avatar">{initials(c.pacienteNome || c.telefone)}</div>
              <div>
                <h4>{c.pacienteNome || c.telefone}</h4>
                <p>{c.ultimoTexto?.slice(0, 60) || '—'}</p>
              </div>
              <div className="meta">
                {c.naoLidas > 0 && <span className="badge">{c.naoLidas}</span>}
              </div>
            </div>
          ))}
          {filtradas.length === 0 && <p className="muted small" style={{ padding: 14 }}>Nenhuma conversa. Conecte o WhatsApp na aba ⚙️.</p>}
        </div>
      </div>

      <div className="chat-panel">
        {!tel ? (
          <div className="chat-empty"><div style={{ fontSize: 40 }}>💬</div><strong>Selecione uma conversa</strong><span className="small">As mensagens do WhatsApp aparecem aqui em tempo real.</span></div>
        ) : (
          <>
            <header>
              <button className="btn btn-sm mobile-chat-back" onClick={() => setTel(null)} aria-label="Voltar à lista de conversas">← Conversas</button>
              <div className="avatar">{initials(atual?.pacienteNome || tel)}</div>
              <div><strong>{atual?.pacienteNome || tel}</strong><div className="small muted">{tel} • bot pausado ao responder</div></div>
            </header>
            <div className="chat-body">
              {msgs.map(m => (
                <div key={m.id} className={`msg ${m.direcao === 'in' ? 'in' : m.direcao === 'out-bot' ? 'out-bot' : 'out'}`}>
                  {m.texto}
                  <small>{m.direcao} • {new Date(m.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
            <form onSubmit={enviar} className="chat-input">
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Responder como atendente... (Enter envia)" />
              <button className="btn btn-primary" type="submit">Enviar</button>
            </form>
          </>
        )}
      </div>

      <div className="detail-panel">
        <header><strong>Detalhe do paciente</strong></header>
        <section>
          <h5>Paciente</h5>
          {detalhe.paciente ? (
            <><div className="kv"><b>{detalhe.paciente.nome}</b></div><div className="kv muted">{detalhe.paciente.telefone}</div><div className="kv small">{detalhe.paciente.observacoes || '—'}</div></>
          ) : <div className="small muted">{tel ? 'Paciente ainda sem cadastro completo.' : 'Selecione uma conversa.'}</div>}
        </section>
        <section>
          <h5>Próteses ({detalhe.proteses.length})</h5>
          {detalhe.proteses.map(p => <div key={p.id} className="kv">🦷 {p.tipo} — <span className={`pill ${p.status}`}>{p.status}</span></div>)}
          {detalhe.proteses.length === 0 && <div className="small muted">Nenhuma prótese vinculada.</div>}
        </section>
        <section>
          <h5>Bot automático</h5>
          <div className="form-row">
            <button className="btn btn-sm" disabled={!tel} onClick={() => bot(false)}>⏸ Pausar</button>
            <button className="btn btn-sm" disabled={!tel} onClick={() => bot(true)}>▶ Retomar</button>
          </div>
          <p className="small muted">Ao enviar mensagem, o bot pausa sozinho e o humano assume.</p>
        </section>
      </div>
    </div>
  );
}
