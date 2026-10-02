import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useSocket } from '../hooks.js';
import { toast } from '../components/ui.jsx';

const FILTROS = [
  { key: 'todas', nome: 'Todas' },
  { key: 'nao-lidas', nome: 'Não lidas' },
];

export default function Monitor() {
  const [stats, setStats] = useState({});
  const [convs, setConvs] = useState([]);
  const [feed, setFeed] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [tel, setTel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');

  const carregar = useCallback(() => {
    api.get('/api/whatsapp/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/api/conversas').then(r => setConvs(r.data)).catch(() => {});
    api.get('/api/whatsapp/feed').then(r => setFeed(r.data)).catch(() => {});
  }, []);
  const carregarMsgs = useCallback((t) => {
    if (!t) return;
    api.get(`/api/conversas/${t}/mensagens`).then(r => setMsgs(r.data)).catch(() => {});
    api.post(`/api/conversas/${t}/ler`).catch(() => {});
  }, []);
  const telRef = useRef(tel);
  telRef.current = tel;
  useEffect(() => { carregar(); }, [carregar]);
  useSocket(['mensagem:nova', 'conversas:update'], () => { carregar(); if (telRef.current) carregarMsgs(telRef.current); });
  useEffect(() => {
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
  }, [carregar]);

  const select = (t) => { setTel(t); carregarMsgs(t); };
  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !tel) return;
    try {
      const r = await api.post(`/api/conversas/${tel}/enviar`, { texto });
      setTexto(''); carregarMsgs(tel);
      if (r.data?.enviado === false) toast('WhatsApp fora do ar — salva como pendente', 'erro');
    } catch (err) { toast(err.response?.data?.error || 'Falha ao enviar', 'erro'); }
  };

  const filtradas = convs.filter((c) => {
    if (busca && !(c.pacienteNome || c.telefone).toLowerCase().includes(busca.toLowerCase()) && !c.telefone.includes(busca)) return false;
    if (filtro === 'nao-lidas') return (c.naoLidas || 0) > 0;
    return true;
  });

  const atual = convs.find((c) => String(c.telefone) === String(tel));

  return (
    <div>
      <div className="grid4">
        <div className="card stat green"><div className="label">Msgs hoje</div><div className="value">{stats.msgsHoje ?? 0}</div><div className="hint">in {stats.inHoje ?? 0} • humano {stats.humanoHoje ?? 0}</div></div>
        <div className="card stat blue"><div className="label">Bot + agentes hoje</div><div className="value">{(stats.botHoje ?? 0) + (stats.agenteHoje ?? 0)}</div><div className="hint">bot {stats.botHoje ?? 0} • agente {stats.agenteHoje ?? 0} • runs {stats.agentesRunsHoje ?? 0}</div></div>
        <div className="card stat amber"><div className="label">Não lidas</div><div className="value">{stats.naoLidas ?? 0}</div><div className="hint">{stats.conversasTotal ?? 0} conversas no total</div></div>
        <div className="card stat dark"><div className="label">Status</div><div className="value" style={{ fontSize: 20 }}>● AO VIVO</div><div className="hint">atualiza via socket + 8s</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
            <div className="form-row">
              {FILTROS.map(f => <button key={f.key} className={`btn btn-sm ${filtro === f.key ? 'btn-primary' : ''}`} onClick={() => setFiltro(f.key)}>{f.nome}</button>)}
            </div>
            <input style={{ width: '100%', marginTop: 8, padding: 9, borderRadius: 10, border: '1px solid #e2e8f0' }} placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {filtradas.map(c => (
              <div key={c.id} onClick={() => select(c.telefone)} className={`conv ${String(tel) === String(c.telefone) ? 'active' : ''}`}>
                <div className="avatar">{String(c.pacienteNome || c.telefone).slice(0, 2).toUpperCase()}</div>
                <div><h4>{c.pacienteNome || c.telefone}</h4><p>{c.ultimoTexto?.slice(0, 55)}</p></div>
                <div className="meta">{c.naoLidas > 0 && <span className="badge">{c.naoLidas}</span>}</div>
              </div>
            ))}
            {filtradas.length === 0 && <p className="muted small" style={{ padding: 12 }}>Nada por aqui. Conecte o WhatsApp em ⚙️.</p>}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!tel ? <div className="chat-empty" style={{ border: 0 }}><div style={{ fontSize: 36 }}>📡</div><b>Painel ao vivo</b><span className="small">Selecione uma conversa para acompanhar e intervir.</span></div> : (
            <>
              <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}><b>{atual?.pacienteNome || tel}</b><div className="small muted">{tel} • clique em Atendimento para histórico completo</div></div>
              <div className="chat-body" style={{ minHeight: 380 }}>
                {msgs.map(m => (
                  <div key={m.id} className={`msg ${m.direcao === 'in' ? 'in' : m.direcao === 'out-agente' || m.direcao === 'out-bot' ? 'out-bot' : 'out'}`}>
                    {m.texto}<small>{m.direcao} • {new Date(m.createdAt).toLocaleTimeString()}</small>
                  </div>
                ))}
              </div>
              <form onSubmit={enviar} className="chat-input">
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Assumir e responder (pausa bot)..." />
                <button className="btn btn-primary" type="submit">Enviar</button>
              </form>
            </>
          )}
        </div>

        <div className="card">
          <strong>⚡ Feed ao vivo</strong>
          <p className="small muted">Últimas mensagens de todas as conversas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflow: 'auto' }}>
            {feed.map(m => (
              <div key={m.id} className="kanban-card" onClick={() => select(m.telefone)} style={{ cursor: 'pointer' }}>
                <div className="small"><b>{m.telefone}</b> • <span className={`pill ${m.direcao === 'in' ? 'pendente' : 'confirmado'}`}>{m.direcao}</span></div>
                <div className="small" style={{ marginTop: 4 }}>{m.texto?.slice(0, 140)}</div>
              </div>
            ))}
            {feed.length === 0 && <p className="muted small">Sem mensagens ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
