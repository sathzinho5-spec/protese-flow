import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Dashboard({ dash, go }) {
  const [recent, setRecent] = useState({ proteses: [], ags: [] });
  useEffect(() => {
    Promise.all([api.get('/api/proteses').catch(() => ({ data: [] })), api.get('/api/agendamentos').catch(() => ({ data: [] }))])
      .then(([p, a]) => setRecent({ proteses: p.data.slice(0, 5), ags: a.data.slice(0, 5) }));
  }, []);

  return (
    <div>
      <div className="grid4">
        <div className="card stat green">
          <div className="label">Pacientes</div>
          <div className="value">{dash.totalPacientes ?? 0}</div>
          <div className="hint">cadastrados no WhatsApp</div>
        </div>
        <div className="card stat amber">
          <div className="label">Aguardando confirmação</div>
          <div className="value">{dash.agendamentosPendentes ?? 0}</div>
          <div className="hint">agendamentos pendentes</div>
        </div>
        <div className="card stat blue">
          <div className="label">Próteses em produção</div>
          <div className="value">{dash.protesesEmAndamento ?? 0}</div>
          <div className="hint">moldagem → laboratório</div>
        </div>
        <div className="card stat dark">
          <div className="label">Recebido / A receber</div>
          <div className="value" style={{ fontSize: 22 }}>R$ {dash.totalRecebido ?? 0} / {dash.totalAReceber ?? 0}</div>
          <div className="hint">prontas p/ entrega: {dash.protesesProntas ?? 0} — <button className="btn btn-sm" onClick={() => go('financeiro')}>Financeiro</button></div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="page-head">
            <div><h2>Próximos agendamentos</h2><p>Clique para gerenciar</p></div>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => go('agenda')}>Ver agenda</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th>Quando</th><th>Status</th></tr></thead>
              <tbody>
                {recent.ags.map(a => (
                  <tr key={a.id}><td>{a.pacienteNome}</td><td>{a.data}</td><td><span className={`pill ${a.status}`}>{a.status}</span></td></tr>
                ))}
                {recent.ags.length === 0 && <tr><td colSpan={3} className="muted">Nenhum agendamento ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="page-head">
            <div><h2>Próteses recentes</h2><p>Últimas movimentações do laboratório</p></div>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => go('proteses')}>Ver próteses</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody>
                {recent.proteses.map(p => (
                  <tr key={p.id}><td>{p.paciente?.nome}</td><td>{p.tipo}</td><td><span className={`pill ${p.status}`}>{p.status}</span></td></tr>
                ))}
                {recent.proteses.length === 0 && <tr><td colSpan={3} className="muted">Nenhuma prótese ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
