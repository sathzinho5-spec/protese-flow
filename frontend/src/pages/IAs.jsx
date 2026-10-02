import { useEffect, useState } from 'react';
import { api, apiError } from '../api.js';
import { toast } from '../components/ui.jsx';

const PASSOS = ['1 Tipo', '2 Chave', '3 Testar', '4 Vincular'];

export default function IAs() {
  const [provs, setProvs] = useState([]);
  const [presets, setPresets] = useState({});
  const [status, setStatus] = useState({});
  const [agents, setAgents] = useState([]);
  const [passo, setPasso] = useState(0);
  const [form, setForm] = useState({ tipo: 'openai', nome: '', baseUrl: '', model: '', apiKey: '' });
  const [criado, setCriado] = useState(null);
  const [teste, setTeste] = useState(null);
  const [msg, setMsg] = useState('');

  const carregar = () => {
    api.get('/api/providers').then(r => setProvs(r.data));
    api.get('/api/ia/presets').then(r => setPresets(r.data));
    api.get('/api/ia/status').then(r => setStatus(r.data));
    api.get('/api/agents').then(r => setAgents(r.data));
  };
  useEffect(() => { carregar(); }, []);

  const escolheTipo = (t) => {
    const p = presets[t] || {};
    setForm(f => ({ ...f, tipo: t, nome: p.nome || t, baseUrl: p.baseUrl || '', model: p.models?.[0] || '' }));
    setPasso(1);
  };

  const criar = async () => {
    setMsg('');
    try {
      const r = await api.post('/api/providers', { ...form, ativo: true, padrao: provs.length === 0 });
      setCriado(r.data); setTeste(null); setPasso(2); carregar();
    } catch (e) { setMsg(e.response?.data?.error || 'Erro ao salvar'); }
  };

  const testar = async (id) => {
    setTeste({ loading: true });
    try {
      const r = await api.post(`/api/providers/${id}/test`);
      setTeste({ ok: true, ...r.data }); carregar();
    } catch (e) { setTeste({ ok: false, erro: e.response?.data?.error || e.message }); carregar(); }
  };

  const salvarModeloAgente = async (agent, modelo) => {
    await api.put(`/api/agents/${agent.id}`, { modelo });
    carregar();
  };

  return (
    <div>
      <div className="grid4">
        <div className="card stat green"><div className="label">Provedores</div><div className="value">{status.total ?? 0}</div><div className="hint">{status.ativos ?? 0} ativos</div></div>
        <div className="card stat blue"><div className="label">IA padrão</div><div className="value" style={{ fontSize: 18 }}>{status.padrao ? `${status.padrao.nome}` : 'regras (grátis)'}</div><div className="hint">{status.padrao?.model || 'sem chave — NLU local'}</div></div>
        <div className="card stat amber"><div className="label">Agentes usando IA</div><div className="value">{agents.filter(a => a.modelo && a.modelo !== 'regras').length}/{agents.length}</div><div className="hint">restante em regras</div></div>
        <div className="card stat dark"><div className="label">Custo</div><div className="value" style={{ fontSize: 18 }}>regras = R$ 0</div><div className="hint">LLM cobra por uso do provedor</div></div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Introduzir IA 🧠 — {PASSOS[passo]}</h2>
        <p className="muted small">Wizard: escolha o provedor → cole a chave → teste → vincule aos agentes. Sem chave, tudo roda em regras locais.</p>
        {passo === 0 && (
          <div className="form-row">
            {Object.entries(presets).map(([k, p]) => (
              <button key={k} className={`btn ${form.tipo === k ? 'btn-primary' : ''}`} onClick={() => escolheTipo(k)}>{p.nome}</button>
            ))}
          </div>
        )}
        {passo === 1 && (
          <div>
            <div className="form-card" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <input placeholder="Nome ex: OpenAI principal" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              <input placeholder="Base URL" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} />
              <input placeholder="Modelo ex: gpt-4o-mini" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} list="models" />
              <input placeholder="API Key (sk-...)" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} />
            </div>
            <datalist id="models">{(presets[form.tipo]?.models || []).map(m => <option key={m} value={m} />)}</datalist>
            <div className="form-row">
              <button className="btn" onClick={() => setPasso(0)}>← Voltar</button>
              <button className="btn btn-primary" onClick={criar}>Salvar e continuar →</button>
            </div>
            {msg && <p className="small">{msg}</p>}
          </div>
        )}
        {passo === 2 && criado && (
          <div>
            <p>Provedor <b>{criado.nome}</b> salvo. Teste a conexão:</p>
            <div className="form-row">
              <button className="btn btn-primary" onClick={() => testar(criado.id)}>⚡ Testar conexão</button>
              <button className="btn" onClick={() => setPasso(3)}>Pular →</button>
            </div>
            {teste?.loading && <p className="small">Testando...</p>}
            {teste?.ok && <p className="small">✅ OK em {teste.latenciaMs}ms — "{teste.resposta}" <button className="btn btn-sm" onClick={() => setPasso(3)}>Vincular agentes →</button></p>}
            {teste?.ok === false && <p className="small">❌ {teste.erro}</p>}
          </div>
        )}
        {passo === 3 && (
          <div>
            <p>Escolha quais agentes usam IA (modelo do provedor padrão) e quais ficam em regras grátis:</p>
            {agents.map(a => (
              <div key={a.id} className="form-row" style={{ alignItems: 'center', marginBottom: 6 }}>
                <b style={{ minWidth: 200 }}>{a.nome}</b>
                <select value={a.modelo || 'regras'} onChange={e => salvarModeloAgente(a, e.target.value)}>
                  <option value="regras">regras (grátis)</option>
                  {(presets[criado?.tipo]?.models || ['gpt-4o-mini', 'gpt-4o']).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            ))}
            <button className="btn btn-primary" onClick={() => { setPasso(0); setCriado(null); carregar(); }}>Concluir ✓</button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 14 }}><strong>Provedores cadastrados</strong></div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Nome</th><th>Tipo/Modelo</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {provs.map(p => (
                <tr key={p.id}>
                  <td><b>{p.nome}</b> {p.padrao && <span className="pill confirmado">padrão</span>}<div className="small muted">...{p.apiKeyTail}</div></td>
                  <td className="small">{p.tipo} • {p.model}<div className="small muted">{p.ultimoStatus || 'nunca testado'}</div></td>
                  <td><span className={`pill ${p.ativo ? 'confirmado' : 'pendente'}`}>{p.ativo ? 'ativo' : 'inativo'}</span></td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => testar(p.id)}>Testar</button>
                    <button className="btn btn-sm" onClick={() => api.put(`/api/providers/${p.id}`, { padrao: true }).then(carregar)}>Padrão</button>
                    <button className="btn btn-sm" onClick={() => api.put(`/api/providers/${p.id}`, { ativo: !p.ativo }).then(carregar)}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button className="btn btn-sm" onClick={() => api.delete(`/api/providers/${p.id}`).then(carregar).catch(e => toast(apiError(e), 'erro'))}>Excluir</button>
                  </td>
                </tr>
              ))}
              {provs.length === 0 && <tr><td colSpan={4} className="muted">Nenhum provedor. Siga o wizard acima.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
