import { useEffect, useState } from 'react';
import { api, apiError } from '../api.js';
import { toast } from '../components/ui.jsx';

export default function Equipe() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', papel: 'atendente' });
  const carregar = () => api.get('/api/usuarios').then(r => setLista(r.data));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/register', form);
      setForm({ nome: '', email: '', senha: '', papel: 'atendente' });
      carregar();
    } catch (err) { toast(apiError(err), 'erro'); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Novo atendente</strong>
        <form onSubmit={salvar} className="form-card" style={{ marginTop: 10 }}>
          <input placeholder="Nome *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          <input placeholder="E-mail *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Senha *" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required />
          <select value={form.papel} onChange={e => setForm({ ...form, papel: e.target.value })}><option value="atendente">Atendente</option><option value="admin">Admin</option><option value="dentista">Dentista</option></select>
        </form>
        <button className="btn btn-primary" onClick={salvar}>Cadastrar acesso</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              {lista.map(u => (
                <tr key={u.id}>
                  <td><b>{u.nome}</b></td><td>{u.email}</td><td><span className="pill">{u.papel}</span></td>
                  <td>{u.ativo === false ? 'inativo' : 'ativo'}</td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => api.put(`/api/usuarios/${u.id}`, { ativo: u.ativo === false ? true : false }).then(carregar)}>{u.ativo === false ? 'Ativar' : 'Desativar'}</button>
                    <button className="btn btn-sm" onClick={() => api.delete(`/api/usuarios/${u.id}`).then(carregar)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
