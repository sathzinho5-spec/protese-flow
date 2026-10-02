import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Pacientes() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({ nome: '', telefone: '', nascimento: '', observacoes: '' });
  const carregar = () => api.get('/api/pacientes').then(r => setLista(r.data));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    await api.post('/api/pacientes', form);
    setForm({ nome: '', telefone: '', nascimento: '', observacoes: '' });
    carregar();
  };

  const filtrada = lista.filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.telefone.includes(busca));

  return (
    <div>
      <div className="page-head">
        <div><h2>{lista.length} pacientes</h2><p>Busque por nome ou WhatsApp</p></div>
        <div className="spacer" />
        <div className="toolbar"><input placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Novo paciente</strong>
        <form onSubmit={salvar} className="form-card" style={{ marginTop: 10 }}>
          <input placeholder="Nome completo *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          <input placeholder="WhatsApp 5511999999999 *" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} required />
          <input placeholder="Nascimento" value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} />
          <input placeholder="Observações (alergia, convênio...)" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        </form>
        <button className="btn btn-primary" onClick={salvar}>Cadastrar paciente</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Paciente</th><th>WhatsApp</th><th>Nasc.</th><th>Obs</th><th></th></tr></thead>
            <tbody>
              {filtrada.map(p => (
                <tr key={p.id}>
                  <td><b>{p.nome}</b><div className="small muted">{new Date(p.createdAt).toLocaleDateString()}</div></td>
                  <td>{p.telefone}</td><td>{p.nascimento || '—'}</td><td className="small">{p.observacoes || '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => api.delete(`/api/pacientes/${p.id}`).then(carregar)}>Excluir</button></td>
                </tr>
              ))}
              {filtrada.length === 0 && <tr><td colSpan={5} className="muted">Nenhum paciente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
