import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api.js';
import { toast } from '../components/ui.jsx';

const vazio = { nome: '', empresa: '', email: '', telefone: '', observacoes: '', origem: '' };

export default function Pacientes() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = () => api.get('/api/pacientes').then(r => setLista(r.data)).catch(e => toast(apiError(e, 'Não foi possível carregar os clientes'), 'erro'));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) await api.put(`/api/pacientes/${editando}`, form);
      else await api.post('/api/pacientes', form);
      setForm(vazio);
      setEditando(null);
      await carregar();
      toast(editando ? 'Cliente atualizado ✓' : 'Cliente cadastrado ✓');
    } catch (err) { toast(apiError(err, 'Não foi possível salvar o cliente'), 'erro'); }
    finally { setSalvando(false); }
  };

  const editar = (p) => {
    setEditando(p.id);
    setForm({ nome: p.nome || '', empresa: p.empresa || '', email: p.email || '', telefone: p.telefone || '', observacoes: p.observacoes || '', origem: p.origem || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelarEdicao = () => { setEditando(null); setForm(vazio); };

  const filtrada = useMemo(() => lista.filter(p => !busca || [p.nome, p.empresa, p.email, p.telefone, p.origem].some(v => String(v || '').toLowerCase().includes(busca.toLowerCase()))), [lista, busca]);

  return (
    <div>
      <div className="page-head">
        <div><h2>{lista.length} clientes</h2><p>Organize seus contatos, empresas e oportunidades</p></div>
        <div className="spacer" />
        <div className="toolbar"><input aria-label="Buscar clientes" placeholder="🔍 Buscar nome, empresa, e-mail..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <div><strong>{editando ? 'Editar cliente' : 'Novo cliente'}</strong><p className="small muted">Contato principal e dados da empresa</p></div>
          {editando && <button type="button" className="btn btn-sm" onClick={cancelarEdicao}>Cancelar edição</button>}
        </div>
        <form onSubmit={salvar} className="form-card client-form">
          <input placeholder="Nome do contato *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} minLength={2} required />
          <input placeholder="Empresa / negócio" value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} />
          <input placeholder="E-mail" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="WhatsApp com DDD *" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} minLength={8} required />
          <input placeholder="Origem do contato" value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })} />
          <input placeholder="Notas internas" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : '+ Cadastrar cliente'}</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Contato</th><th>Empresa</th><th>WhatsApp</th><th>Origem</th><th>Notas</th><th>Ações</th></tr></thead>
            <tbody>
              {filtrada.map(p => (
                <tr key={p.id}>
                  <td><b>{p.nome}</b><div className="small muted">{p.email || 'Sem e-mail'}</div></td>
                  <td>{p.empresa || '—'}</td><td>{p.telefone}</td><td>{p.origem || '—'}</td><td className="small">{p.observacoes || '—'}</td>
                  <td><button type="button" className="btn btn-sm" onClick={() => editar(p)}>Editar</button></td>
                </tr>
              ))}
              {filtrada.length === 0 && <tr><td colSpan={6} className="muted">{busca ? 'Nenhum cliente corresponde à busca.' : 'Cadastre seu primeiro cliente para iniciar o pipeline.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
