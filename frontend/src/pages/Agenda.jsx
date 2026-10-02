import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../components/ui.jsx';

export default function Agenda() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ pacienteNome: '', telefone: '', data: '', dataHora: '', motivo: '' });
  const carregar = () => api.get('/api/agendamentos').then(r => setLista(r.data));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    // P0-3: data real opcional — se preenchida, gera texto + ISO
    if (form.dataHora) {
      const d = new Date(form.dataHora);
      payload.dataISO = d.toISOString();
      if (!form.data) payload.data = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    delete payload.dataHora;
    try {
      await api.post('/api/agendamentos', payload);
      setForm({ pacienteNome: '', telefone: '', data: '', dataHora: '', motivo: '' });
      carregar();
    } catch (err) { toast(err.response?.data?.error || 'Falha ao agendar', 'erro'); }
  };
  const setStatus = (id, status) => api.put(`/api/agendamentos/${id}`, { status }).then(carregar);

  const pendentes = lista.filter(a => a.status === 'pendente');
  const confirmados = lista.filter(a => a.status === 'confirmado');

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Novo agendamento</strong>
        <form onSubmit={salvar} className="form-card" style={{ marginTop: 10 }}>
          <input placeholder="Paciente *" value={form.pacienteNome} onChange={e => setForm({ ...form, pacienteNome: e.target.value })} required />
          <input placeholder="WhatsApp *" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} required />
          <input placeholder="Data/hora ex: 10/10 14h *" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
          <input type="datetime-local" title="Data real (opcional, p/ ordenar e lembrar)" value={form.dataHora} onChange={e => setForm({ ...form, dataHora: e.target.value })} />
          <input placeholder="Motivo (avaliação, prova, ajuste...)" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
        </form>
        <button className="btn btn-primary" onClick={salvar}>Agendar</button>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>⏳ Pendentes ({pendentes.length})</h3>
          {pendentes.map(a => (
            <div key={a.id} className="kanban-card" style={{ marginBottom: 8 }}>
              <strong>{a.pacienteNome}</strong>
              <span className="small muted">{a.dataISO ? new Date(a.dataISO).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : a.data} • {a.motivo} • {a.telefone}</span>
              <div className="form-row" style={{ marginTop: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={() => setStatus(a.id, 'confirmado')}>Confirmar</button>
                <button className="btn btn-sm" onClick={() => setStatus(a.id, 'cancelado')}>Cancelar</button>
                <button className="btn btn-sm" onClick={() => api.put(`/api/agendamentos/${a.id}`, { enviarLembrete: true, lembreteEnviado: false }).then(() => toast('Lembrete programado 📲'))}>🔔 Lembrar</button>
              </div>
            </div>
          ))}
          {pendentes.length === 0 && <p className="muted small">Nada pendente 🎉</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>✅ Confirmados ({confirmados.length})</h3>
          {confirmados.map(a => (
            <div key={a.id} className="kanban-card" style={{ marginBottom: 8 }}>
              <strong>{a.pacienteNome}</strong>
              <span className="small muted">{a.dataISO ? new Date(a.dataISO).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : a.data} • {a.motivo}</span>
              <div className="form-row" style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setStatus(a.id, 'cancelado')}>Cancelar</button>
              </div>
            </div>
          ))}
          {confirmados.length === 0 && <p className="muted small">Nenhum confirmado ainda.</p>}
        </div>
      </div>
    </div>
  );
}
