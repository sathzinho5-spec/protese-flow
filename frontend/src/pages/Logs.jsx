import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Logs() {
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api.get('/api/logs').then(r => setLista(r.data)).catch(e => setErro(e.response?.data?.error || 'Sem acesso (apenas admin)'));
  }, []);
  if (erro) return <div className="card"><b>Auditoria</b><p className="muted">{erro}</p></div>;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 16 }}><h2 style={{ margin: 0 }}>Auditoria 🕵️</h2><p className="muted small">Quem fez o quê — últimos 200 eventos</p></div>
      <div className="table-wrap" style={{ border: 0 }}>
        <table>
          <thead><tr><th>Quando</th><th>Autor</th><th>Ação</th><th>Detalhe</th></tr></thead>
          <tbody>
            {lista.map(l => (
              <tr key={l.id}><td className="small">{new Date(l.createdAt).toLocaleString()}</td><td><b>{l.autor}</b><div className="small muted">{l.papel}</div></td><td><span className="pill">{l.acao}</span></td><td className="small">{l.entidade}:{String(l.entidadeId).slice(-6)} — {l.detalhe}</td></tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={4} className="muted">Sem eventos ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
