import { useEffect, useState } from 'react';
import { api, apiError, authUrl } from '../api.js';
import { toast } from '../components/ui.jsx';

export default function Financeiro() {
  const [data, setData] = useState({ lancamentos: [], totalRecebido: 0, totalAReceber: 0 });
  const [proteses, setProteses] = useState([]);
  const [form, setForm] = useState({ descricao: '', valor: '', proteseId: '', forma: 'pix', tipo: 'entrada', status: 'pendente', data: new Date().toISOString().slice(0, 10) });
  const carregar = () => {
    api.get('/api/financeiro').then(r => setData(r.data));
    api.get('/api/proteses').then(r => setProteses(r.data));
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    await api.post('/api/financeiro', form);
    setForm({ descricao: '', valor: '', proteseId: '', forma: 'pix', tipo: 'entrada', status: 'pendente', data: new Date().toISOString().slice(0, 10) });
    carregar();
  };

  return (
    <div>
      <div className="grid4">
        <div className="card stat green"><div className="label">Recebido</div><div className="value">R$ {data.totalRecebido}</div><div className="hint">pagamentos confirmados</div></div>
        <div className="card stat amber"><div className="label">A receber</div><div className="value">R$ {data.totalAReceber}</div><div className="hint">entradas + parcelas pendentes</div></div>
        <div className="card stat blue"><div className="label">Lançamentos</div><div className="value">{data.lancamentos.length}</div><div className="hint">total de cobranças</div></div>
        <div className="card stat dark"><div className="label">Ticket médio</div><div className="value">R$ {data.lancamentos.length ? Math.round((data.totalRecebido + data.totalAReceber) / data.lancamentos.length) : 0}</div><div className="hint">por lançamento</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Novo lançamento (entrada / parcela)</strong>
        <form onSubmit={salvar} className="form-card" style={{ marginTop: 10, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <input placeholder="Descrição ex: Entrada dentadura D. Maria *" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required />
          <input placeholder="Valor R$ *" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required />
          <select value={form.proteseId} onChange={e => setForm({ ...form, proteseId: e.target.value })}>
            <option value="">Vincular prótese (opcional)...</option>
            {proteses.map(p => <option key={p.id} value={p.id}>{p.paciente?.nome} — {p.tipo} (saldo R$ {p.saldo})</option>)}
          </select>
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="entrada">Entrada</option><option value="parcela">Parcela</option><option value="pagamento">Pagamento total</option></select>
          <select value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago ✓</option></select>
        </form>
        <button className="btn btn-primary" onClick={salvar}>Lançar</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Paciente/Prótese</th><th>Forma</th><th>Valor</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.lancamentos.map(l => (
                <tr key={l.id}>
                  <td>{l.data}</td>
                  <td><b>{l.descricao}</b><div className="small muted">{l.tipo}</div></td>
                  <td className="small">{l.paciente?.nome || '—'}{l.protese ? ` • ${l.protese.tipo}` : ''}</td>
                  <td>{l.forma}</td>
                  <td><b>R$ {l.valor}</b></td>
                  <td><span className={`pill ${l.status === 'pago' ? 'confirmado' : 'pendente'}`}>{l.status}</span></td>
                  <td className="actions">
                    {l.status !== 'pago' && <button className="btn btn-sm btn-primary" onClick={() => api.put(`/api/financeiro/${l.id}`, { status: 'pago' }).then(carregar)}>Dar baixa</button>}
                    <a className="btn btn-sm" href={authUrl(`/api/financeiro/${l.id}/recibo.pdf`)} target="_blank" rel="noreferrer">🧾 Recibo</a>
                    <button className="btn btn-sm" onClick={() => api.delete(`/api/financeiro/${l.id}`).then(carregar).catch(e => toast(apiError(e, 'Apenas admin pode excluir'), 'erro'))}>Excluir</button>
                  </td>
                </tr>
              ))}
              {data.lancamentos.length === 0 && <tr><td colSpan={7} className="muted">Nenhum lançamento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
