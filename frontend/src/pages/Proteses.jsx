import { useEffect, useState } from 'react';
import { api, apiError, uploadsUrl, authUrl } from '../api.js';
import { toast } from '../components/ui.jsx';

const TIPOS = ['Prótese Total', 'Prótese Parcial Removível', 'Coroa', 'Ponte Fixa', 'Overdenture', 'Implante', 'Placa Bruxismo'];
const STATUS = ['orçado', 'aprovado', 'moldagem', 'prova', 'laboratório', 'pronta', 'entregue', 'ajuste'];
const ETAPAS_FOTO = ['geral', 'moldagem', 'prova', 'laboratório', 'pronta', 'entregue'];

export default function Proteses() {
  const [lista, setLista] = useState([]);
  const [pacs, setPacs] = useState([]);
  const [modo, setModo] = useState('kanban');
  const [form, setForm] = useState({ pacienteId: '', tipo: 'Prótese Total', status: 'orçado', valor: '', previsao: '' });
  const [sel, setSel] = useState(null); // prótese selecionada p/ fotos + financeiro
  const [fotos, setFotos] = useState([]);
  const [etapa, setEtapa] = useState('moldagem');

  const carregar = () => {
    api.get('/api/proteses').then(r => {
      setLista(r.data);
      if (sel) { const a = r.data.find(x => x.id === sel.id); if (a) setSel(a); }
    });
    api.get('/api/pacientes').then(r => setPacs(r.data));
  };
  const carregarFotos = (id) => api.get(`/api/proteses/${id}/fotos`).then(r => setFotos(r.data));
  useEffect(() => { carregar(); }, []);

  const open = (p) => { setSel(p); carregarFotos(p.id); };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.pacienteId) return toast('Escolha o paciente', 'erro');
    await api.post('/api/proteses', form);
    setForm({ pacienteId: '', tipo: 'Prótese Total', status: 'orçado', valor: '', previsao: '' });
    carregar();
  };

  const uploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel) return;
    const fd = new FormData();
    fd.append('foto', file);
    fd.append('etapa', etapa);
    await api.post(`/api/proteses/${sel.id}/fotos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    carregarFotos(sel.id);
  };

  const lancarEntrada = async () => {
    const valor = prompt(`Lançar pagamento para ${sel.paciente?.nome} — saldo R$ ${sel.saldo}. Valor:`);
    if (!valor) return;
    await api.post('/api/financeiro', { descricao: `Pagamento ${sel.tipo} — ${sel.paciente?.nome}`, valor, proteseId: sel.id, tipo: 'parcela', forma: 'pix', status: 'pago' });
    carregar();
    toast('Pagamento lançado ✓');
  };

  return (
    <div>
      <div className="page-head">
        <div><h2>Fluxo de próteses + fotos + financeiro</h2><p>Clique num card para ver fotos e saldo</p></div>
        <div className="spacer" />
        <button className={`btn btn-sm ${modo === 'kanban' ? 'btn-primary' : ''}`} onClick={() => setModo('kanban')}>Kanban</button>
        <button className={`btn btn-sm ${modo === 'lista' ? 'btn-primary' : ''}`} onClick={() => setModo('lista')}>Lista</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <form onSubmit={salvar} className="form-card">
          <select value={form.pacienteId} onChange={e => setForm({ ...form, pacienteId: e.target.value })}>
            <option value="">Paciente...*</option>
            {pacs.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.telefone})</option>)}
          </select>
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Valor total R$ ex: 1200" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          <input placeholder="Previsão ex: 20/10" value={form.previsao} onChange={e => setForm({ ...form, previsao: e.target.value })} />
        </form>
        <button className="btn btn-primary" onClick={salvar}>+ Nova prótese</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 340px' : '1fr', gap: 12 }}>
        <div>
          {modo === 'kanban' ? (
            <div className="kanban">
              {STATUS.map(s => (
                <div key={s} className="kanban-col">
                  <h4>{s} <span className="pill">{lista.filter(p => p.status === s).length}</span></h4>
                  {lista.filter(p => p.status === s).map(p => (
                    <div key={p.id} className="kanban-card" onClick={() => open(p)} style={{ cursor: 'pointer', border: sel?.id === p.id ? '2px solid #0e7c61' : undefined }}>
                      <strong>{p.paciente?.nome || '—'}</strong>
                      <span className="small muted">{p.tipo} • R$ {p.valor || '—'} • pago R$ {p.totalPago || 0} • saldo R$ {p.saldo}</span>
                      <select value={p.status} onClick={e => e.stopPropagation()} onChange={e => api.put(`/api/proteses/${p.id}`, { status: e.target.value }).then(carregar)}>
                        {STATUS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Paciente</th><th>Tipo</th><th>Status</th><th>Valor/Pago/Saldo</th><th></th></tr></thead>
                  <tbody>
                    {lista.map(p => (
                      <tr key={p.id} onClick={() => open(p)} style={{ cursor: 'pointer' }}>
                        <td><b>{p.paciente?.nome}</b><div className="small muted">{p.previsao}</div></td><td>{p.tipo}</td>
                        <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                        <td className="small">R$ {p.valor} / <b style={{ color: 'green' }}>{p.totalPago}</b> / <b style={{ color: p.saldo > 0 ? 'red' : 'green' }}>{p.saldo}</b></td>
                        <td><button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); api.delete(`/api/proteses/${p.id}`).then(carregar); }}>Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {sel && (
          <div className="card">
            <div className="page-head"><div><h2>{sel.paciente?.nome}</h2><p>{sel.tipo} • <span className={`pill ${sel.status}`}>{sel.status}</span></p></div><div className="spacer" /><button className="btn btn-sm" onClick={() => setSel(null)}>✕</button></div>
            <p className="small">💰 Valor R$ {sel.valor} • Pago R$ {sel.totalPago} • <b>Saldo R$ {sel.saldo}</b></p>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <button className="btn btn-sm btn-primary" onClick={lancarEntrada}>+ Lançar pagamento</button>
              <a className="btn btn-sm" href={authUrl(`/api/proteses/${sel.id}/orcamento.pdf`)} target="_blank" rel="noreferrer">📄 Orçamento PDF</a>
              <button className="btn btn-sm" onClick={() => api.post(`/api/proteses/${sel.id}/enviar-orcamento`).then(() => toast('Orçamento enviado no WhatsApp 📲')).catch(e => toast(apiError(e), 'erro'))}>📲 Enviar orçamento</button>
            </div>
            <hr />
            <strong>📸 Fotos de evolução</strong>
            <div className="form-row" style={{ margin: '8px 0' }}>
              <select value={etapa} onChange={e => setEtapa(e.target.value)}>{ETAPAS_FOTO.map(x => <option key={x}>{x}</option>)}</select>
              <label className="btn btn-sm">📤 Enviar foto<input type="file" accept="image/*" hidden onChange={uploadFoto} /></label>
            </div>
            <div className="gallery">
              {fotos.map(f => (
                <div key={f.id} className="photo">
                  <img src={uploadsUrl(f.url)} alt={f.etapa} />
                  <span>{f.etapa}</span>
                  <button onClick={() => api.delete(`/api/fotos/${f.id}`).then(() => carregarFotos(sel.id))}>excluir</button>
                </div>
              ))}
              {fotos.length === 0 && <p className="muted small">Sem fotos. Envie moldagem, prova, resultado.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
