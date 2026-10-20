import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Pacientes() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({ nome: '', empresa: '', email: '', telefone: '', observacoes: '', origem: '' });
  const carregar = () => api.get('/api/pacientes').then(r => setLista(r.data));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    await api.post('/api/pacientes', form);
    setForm({ nome: '', empresa: '', email: '', telefone: '', observacoes: '', origem: '' });
    carregar();
  };

  const filtrada = lista.filter(p => !busca || [p.nome, p.empresa, p.email, p.telefone].some(v => String(v || '').toLowerCase().includes(busca.toLowerCase())));

  return (
    <div>
      <div className="page-head">
        <div><h2>{lista.length} clientes</h2><p>Busque por nome, empresa, e-mail ou WhatsApp</p></div>
        <div className="spacer" />
        <div className="toolbar"><input placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Novo cliente</strong>
        <form onSubmit={salvar} className="form-card" style={{ marginTop: 10 }}>
          <input placeholder="Nome do contato *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          <input placeholder="Empresa / negócio" value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} />
          <input placeholder="E-mail" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="WhatsApp com DDD *" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} required />
          <input placeholder="Como chegou até nós?" value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })} />
          <input placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        </form>
        <button className="btn btn-primary" onClick={salvar}>Cadastrar cliente</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Contato</th><th>Empresa</th><th>Contato</th><th>Origem</th><th>Observações</th><th></th></tr></thead>
            <tbody>
              {filtrada.map(p => (
                <tr key={p.id}>
                  <td><b>{p.nome}</b><div className="small muted">{p.email || '—'}</div></td>
                  <td>{p.empresa || '—'}</td><td>{p.telefone}</td><td>{p.origem || '—'}</td><td className="small">{p.observacoes || '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => api.delete(`/api/pacientes/${p.id}`).then(carregar)}>Excluir</button></td>
                </tr>
              ))}
              {filtrada.length === 0 && <tr><td colSpan={6} className="muted">Nenhum cliente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
