import { useEffect, useState } from 'react';
import { api, apiError } from '../api.js';
import { toast } from '../components/ui.jsx';

const MODELOS = ['regras', 'gpt-4o-mini', 'gpt-4o', 'gemini-1.5-flash'];

export default function Agentes() {
  const [agents, setAgents] = useState([]);
  const [funcs, setFuncs] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ nome: '', descricao: '', prompt: '', funcoes: [], gatilhos: '', prioridade: 50, ativo: true, modelo: 'regras' });
  const [settings, setSettings] = useState({ provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', apiKey: '' });
  const [runs, setRuns] = useState([]);
  const [teste, setTeste] = useState({ mensagem: 'Quanto custa uma dentadura?', telefone: '5511999999999' });
  const [resTeste, setResTeste] = useState(null);

  const carregar = () => {
    api.get('/api/agents').then(r => { setAgents(r.data); if (!sel && r.data[0]) open(r.data[0], r.data); });
    api.get('/api/agent-functions').then(r => setFuncs(r.data));
    api.get('/api/agent-settings').then(r => setSettings(s => ({ ...s, ...r.data })));
    api.get('/api/agent-runs').then(r => setRuns(r.data));
  };
  useEffect(() => { carregar(); }, []);

  const open = (a, list) => {
    const arr = list || agents;
    const full = arr.find(x => x.id === a.id) || a;
    setSel(full);
    setForm({ nome: full.nome || '', descricao: full.descricao || '', prompt: full.prompt || '', funcoes: full.funcoes || [], gatilhos: full.gatilhos || '', prioridade: full.prioridade ?? 50, ativo: full.ativo !== false, modelo: full.modelo || 'regras' });
    setResTeste(null);
  };

  const toggleFunc = (k) => setForm(f => ({ ...f, funcoes: f.funcoes.includes(k) ? f.funcoes.filter(x => x !== k) : [...f.funcoes, k] }));

  const salvar = async () => {
    if (!form.nome || !form.prompt) return toast('Nome e prompt obrigatórios', 'erro');
    if (sel?.id) await api.put(`/api/agents/${sel.id}`, form);
    else await api.post('/api/agents', form);
    const r = await api.get('/api/agents');
    setAgents(r.data);
    if (sel?.id) open({ ...sel, ...form }, r.data);
    toast('Agente salvo ✓');
  };
  const novo = () => { setSel(null); setForm({ nome: '', descricao: '', prompt: '', funcoes: [], gatilhos: '', prioridade: 50, ativo: true, modelo: 'regras' }); };
  const excluir = async () => {
    if (!sel?.id || !confirm('Excluir agente?')) return;
    await api.delete(`/api/agents/${sel.id}`).catch(e => toast(apiError(e, 'Apenas admin'), 'erro'));
    setSel(null); novo(); carregar();
  };
  const testar = async () => {
    if (!sel?.id) return toast('Selecione um agente', 'erro');
    const r = await api.post(`/api/agents/${sel.id}/test`, teste);
    setResTeste(r.data);
    carregar();
  };
  const saveSettings = async () => {
    await api.put('/api/agent-settings', settings).catch(e => toast(apiError(e, 'Apenas admin'), 'erro'));
    toast('Configuração salva ✓ (chave não é exibida de volta)');
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <strong>🤖 Cérebro (LLM opcional)</strong>
        <p className="small muted">Sem chave, os agentes rodam em modo <b>regras</b> (grátis, offline). Com chave OpenAI-compatível, o modelo do agente reescreve a resposta.</p>
        <div className="form-card" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <select value={settings.provider || 'openai'} onChange={e => setSettings({ ...settings, provider: e.target.value })}><option value="openai">OpenAI</option><option value="gemini">Gemini (compat)</option><option value="custom">Custom</option></select>
          <select value={settings.model || 'gpt-4o-mini'} onChange={e => setSettings({ ...settings, model: e.target.value })}>{MODELOS.map(m => <option key={m}>{m}</option>)}</select>
          <input placeholder="Base URL" value={settings.baseUrl || ''} onChange={e => setSettings({ ...settings, baseUrl: e.target.value })} />
          <input placeholder="API Key (sk-...)" type="password" value={settings.apiKey || ''} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} />
        </div>
        <button className="btn btn-sm btn-primary" onClick={saveSettings}>Salvar cérebro</button>
        {settings.apiKeySet && <span className="pill confirmado" style={{ marginLeft: 8 }}>chave configurada</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
        <div className="card">
          <div className="page-head"><div><h2>Agentes ({agents.length})</h2><p>Roteamento por gatilho + prioridade</p></div></div>
          {agents.sort((a, b) => a.prioridade - b.prioridade).map(a => (
            <div key={a.id} onClick={() => open(a)} className="kanban-card" style={{ marginBottom: 8, cursor: 'pointer', border: sel?.id === a.id ? '2px solid #0e7c61' : undefined }}>
              <strong>{a.ativo === false ? '⏸ ' : '🤖 '}{a.nome}</strong>
              <div className="small muted">prio {a.prioridade} • {a.modelo} • {(a.funcoes || []).length} funções</div>
              <div className="small">{a.descricao}</div>
            </div>
          ))}
          <button className="btn" style={{ width: '100%' }} onClick={novo}>+ Novo agente</button>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>{sel ? `Editar — ${sel.nome}` : 'Novo agente'}</h2>
          <div className="form-card" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Nome * ex: Recepcionista" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            <input placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            <input placeholder="Gatilhos (vírgula) ex: preço, orçamento" value={form.gatilhos} onChange={e => setForm({ ...form, gatilhos: e.target.value })} />
            <div className="form-row">
              <select value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}>{MODELOS.map(m => <option key={m}>{m}</option>)}</select>
              <input type="number" style={{ width: 90 }} value={form.prioridade} onChange={e => setForm({ ...form, prioridade: Number(e.target.value) })} title="Prioridade (menor = primeiro)" />
              <label className="small"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> ativo</label>
            </div>
          </div>
          <label className="small"><b>Prompt do agente *</b> — personalidade, regras, o que nunca fazer</label>
          <textarea rows={7} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', marginTop: 6 }} placeholder="Você é a recepcionista da clínica..." value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} />
          <div style={{ marginTop: 10 }}><b>Funções permitidas</b><p className="small muted">O agente só executa o que está marcado. Intenção fora disso cai no menu antigo.</p>
            <div className="form-row">
              {funcs.map(f => (
                <label key={f.key} className={`pill ${form.funcoes.includes(f.key) ? 'confirmado' : ''}`} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.funcoes.includes(f.key)} onChange={() => toggleFunc(f.key)} /> {f.nome}
                </label>
              ))}
            </div>
            {funcs.map(f => form.funcoes.includes(f.key) && <div key={f.key} className="small muted">• <b>{f.key}</b>: {f.descricao}</div>)}
          </div>
          <div className="form-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={salvar}>Salvar agente</button>
            {sel?.id && <button className="btn" onClick={excluir}>Excluir</button>}
          </div>

          <hr />
          <strong>🧪 Testar prompt + função</strong>
          <div className="form-card" style={{ gridTemplateColumns: '1fr 200px auto', marginTop: 8 }}>
            <input placeholder="Mensagem do paciente ex: Quanto custa?" value={teste.mensagem} onChange={e => setTeste({ ...teste, mensagem: e.target.value })} />
            <input placeholder="Telefone teste" value={teste.telefone} onChange={e => setTeste({ ...teste, telefone: e.target.value })} />
            <button className="btn btn-primary" onClick={testar}>Testar</button>
          </div>
          {resTeste && (
            <div className="kanban-card">
              <div className="small">intenção: <b>{resTeste.intent}</b> • função: <b>{resTeste.funcao}</b> • via: {resTeste.via}</div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{resTeste.reply}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 0 }}>
        <div style={{ padding: 14 }}><strong>Últimas execuções no WhatsApp</strong></div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Quando</th><th>Agente</th><th>Telefone</th><th>Intenção → Função</th><th>Resposta</th></tr></thead>
            <tbody>
              {runs.slice(0, 20).map(r => (
                <tr key={r.id}><td className="small">{new Date(r.createdAt).toLocaleString()}</td><td><b>{r.agentNome}</b><div className="small muted">{r.via}</div></td><td>{r.telefone}</td><td className="small">{r.intencao} → <b>{r.funcao}</b></td><td className="small">{r.resposta?.slice(0, 120)}</td></tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={5} className="muted">Nenhuma execução ainda. Envie algo no WhatsApp ou teste acima.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
