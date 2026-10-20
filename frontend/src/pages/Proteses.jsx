import { useEffect, useState } from 'react';
import { api, apiError, uploadsUrl, authUrl } from '../api.js';
import { toast } from '../components/ui.jsx';

const TIPOS = ['Site institucional', 'Landing page', 'Loja virtual', 'Sistema web', 'Aplicativo', 'Automação / integração', 'Manutenção'];
const STATUS = ['Briefing', 'Planejamento', 'Desenvolvimento', 'Revisão', 'Concluído', 'Pausado'];
const STATUS_LEGADO = { 'orçado': 'Briefing', aprovado: 'Planejamento', moldagem: 'Desenvolvimento', 'laboratório': 'Desenvolvimento', prova: 'Revisão', pronta: 'Revisão', entregue: 'Concluído', ajuste: 'Revisão' };
const ETAPAS_FOTO = ['Referências', 'Layout', 'Desenvolvimento', 'Revisão', 'Entrega'];
const etapaAtual = (status) => STATUS_LEGADO[status] || STATUS.find((s) => s.toLowerCase() === String(status).toLowerCase()) || 'Briefing';

export default function Proteses() {
  const [lista, setLista] = useState([]);
  const [pacs, setPacs] = useState([]);
  const [modo, setModo] = useState('kanban');
  const [form, setForm] = useState({ pacienteId: '', tipo: 'Site institucional', status: 'Briefing', valor: '', previsao: '' });
  const [sel, setSel] = useState(null); // projeto selecionado para arquivos e financeiro
  const [fotos, setFotos] = useState([]);
  const [etapa, setEtapa] = useState('Briefing');

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
    if (!form.pacienteId) return toast('Escolha o cliente', 'erro');
    await api.post('/api/proteses', form);
    setForm({ pacienteId: '', tipo: 'Site institucional', status: 'Briefing', valor: '', previsao: '' });
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
    const cliente = sel.paciente?.empresa || sel.paciente?.nome;
    const valor = prompt(`Registrar pagamento de ${cliente} — saldo R$ ${sel.saldo}. Valor:`);
    if (!valor) return;
    await api.post('/api/financeiro', { descricao: `Pagamento ${sel.tipo} — ${cliente}`, valor, proteseId: sel.id, tipo: 'parcela', forma: 'pix', status: 'pago' });
    carregar();
    toast('Pagamento lançado ✓');
  };

  return (
    <div>
      <div className="page-head">
        <div><h2>Projetos e propostas</h2><p>Acompanhe etapas, arquivos, prazos e valores</p></div>
        <div className="spacer" />
        <button className={`btn btn-sm ${modo === 'kanban' ? 'btn-primary' : ''}`} onClick={() => setModo('kanban')}>Kanban</button>
        <button className={`btn btn-sm ${modo === 'lista' ? 'btn-primary' : ''}`} onClick={() => setModo('lista')}>Lista</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <form onSubmit={salvar} className="form-card">
          <select value={form.pacienteId} onChange={e => setForm({ ...form, pacienteId: e.target.value })}>
            <option value="">Cliente...*</option>
            {pacs.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.telefone})</option>)}
          </select>
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Valor total R$ ex: 1200" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          <input placeholder="Previsão ex: 20/10" value={form.previsao} onChange={e => setForm({ ...form, previsao: e.target.value })} />
        </form>
        <button className="btn btn-primary" onClick={salvar}>+ Novo projeto</button>
      </div>

      <div className={`project-layout ${sel ? 'with-selection' : ''}`}>
        <div>
          {modo === 'kanban' ? (
            <div className="kanban">
              {STATUS.map(s => (
                <div key={s} className="kanban-col">
                  <h4>{s} <span className="pill">{lista.filter(p => etapaAtual(p.status) === s).length}</span></h4>
                  {lista.filter(p => etapaAtual(p.status) === s).map(p => (
                    <div key={p.id} className="kanban-card" onClick={() => open(p)} style={{ cursor: 'pointer', border: sel?.id === p.id ? '2px solid #0e7c61' : undefined }}>
                      <strong>{p.paciente?.empresa || p.paciente?.nome || '—'}</strong>
                      <span className="small muted">{p.tipo} • R$ {p.valor || '—'} • pago R$ {p.totalPago || 0} • saldo R$ {p.saldo}</span>
                      <select value={etapaAtual(p.status)} onClick={e => e.stopPropagation()} onChange={e => api.put(`/api/proteses/${p.id}`, { status: e.target.value }).then(carregar)}>
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
                  <thead><tr><th>Cliente</th><th>Projeto</th><th>Etapa</th><th>Valor/Pago/Saldo</th><th></th></tr></thead>
                  <tbody>
                    {lista.map(p => (
                      <tr key={p.id} onClick={() => open(p)} style={{ cursor: 'pointer' }}>
                        <td><b>{p.paciente?.empresa || p.paciente?.nome}</b><div className="small muted">{p.previsao}</div></td><td>{p.tipo}</td>
                        <td><span className={`pill ${etapaAtual(p.status)}`}>{etapaAtual(p.status)}</span></td>
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
          <div className="card project-detail">
            <div className="page-head"><div><h2>{sel.paciente?.empresa || sel.paciente?.nome}</h2><p>{sel.tipo} • <span className={`pill ${etapaAtual(sel.status)}`}>{etapaAtual(sel.status)}</span></p></div><div className="spacer" /><button className="btn btn-sm" onClick={() => setSel(null)}>✕</button></div>
            <p className="small">💰 Valor R$ {sel.valor} • Pago R$ {sel.totalPago} • <b>Saldo R$ {sel.saldo}</b></p>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <button className="btn btn-sm btn-primary" onClick={lancarEntrada}>+ Registrar pagamento</button>
              <a className="btn btn-sm" href={authUrl(`/api/proteses/${sel.id}/orcamento.pdf`)} target="_blank" rel="noreferrer">📄 Proposta PDF</a>
              <button className="btn btn-sm" onClick={() => api.post(`/api/proteses/${sel.id}/enviar-orcamento`).then(() => toast('Proposta enviada no WhatsApp 📲')).catch(e => toast(apiError(e), 'erro'))}>📲 Enviar proposta</button>
            </div>
            <hr />
            <strong>📎 Arquivos do projeto</strong>
            <div className="form-row" style={{ margin: '8px 0' }}>
              <select value={etapa} onChange={e => setEtapa(e.target.value)}>{ETAPAS_FOTO.map(x => <option key={x}>{x}</option>)}</select>
              <label className="btn btn-sm">📤 Anexar material<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={uploadFoto} /></label>
            </div>
            <div className="gallery">
              {fotos.map(f => (
                <div key={f.id} className="photo">
                  {f.mimeType === 'application/pdf'
                    ? <a className="pdf-attachment" href={uploadsUrl(f.url)} target="_blank" rel="noreferrer">📄 Abrir PDF</a>
                    : <img src={uploadsUrl(f.url)} alt={f.etapa} />}
                  <span title={f.originalName || f.legenda}>{f.etapa}</span>
                  <button onClick={() => api.delete(`/api/fotos/${f.id}`).then(() => carregarFotos(sel.id))}>excluir</button>
                </div>
              ))}
              {fotos.length === 0 && <p className="muted small">Nenhum arquivo enviado para este projeto.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
