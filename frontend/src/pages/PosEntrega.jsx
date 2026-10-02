import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function PosEntrega() {
  const [lista, setLista] = useState([]);
  const carregar = () => api.get('/api/followups').then(r => setLista(r.data));
  useEffect(() => { carregar(); }, []);
  const pend = lista.filter(f => f.status === 'agendado');
  const enviados = lista.filter(f => f.status !== 'agendado');

  return (
    <div>
      <div className="page-head"><div><h2>Pós-entrega e garantia 🛡️</h2><p>Gerados automaticamente ao marcar prótese como entregue</p></div></div>
      <div className="grid2">
        <div className="card">
          <h3>⏳ Agendados ({pend.length})</h3>
          {pend.map(f => (
            <div key={f.id} className="kanban-card" style={{ marginBottom: 8 }}>
              <strong>{f.titulo}</strong>
              <div className="small muted">{f.paciente?.nome} • {f.protese?.tipo} • prev {new Date(f.previstoPara).toLocaleDateString()}</div>
              <div className="small" style={{ margin: '6px 0', background: '#f8fafc', padding: 8, borderRadius: 8 }}>{f.mensagem}</div>
              <div className="form-row">
                <button className="btn btn-sm btn-primary" onClick={() => api.post(`/api/followups/${f.id}/enviar`).then(carregar)}>📲 Enviar agora</button>
                <button className="btn btn-sm" onClick={() => api.put(`/api/followups/${f.id}`, { status: 'concluido' }).then(carregar)}>Concluir</button>
              </div>
            </div>
          ))}
          {pend.length === 0 && <p className="muted small">Nada agendado. Marque uma prótese como entregue.</p>}
        </div>
        <div className="card">
          <h3>✅ Enviados / concluídos ({enviados.length})</h3>
          {enviados.map(f => (
            <div key={f.id} className="kanban-card" style={{ marginBottom: 8 }}>
              <strong>{f.titulo}</strong> <span className={`pill ${f.status === 'enviado' ? 'confirmado' : ''}`}>{f.status}</span>
              <div className="small muted">{f.paciente?.nome} • {new Date(f.previstoPara).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
