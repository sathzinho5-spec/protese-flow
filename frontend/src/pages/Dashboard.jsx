import { useEffect, useState } from 'react';
import { api } from '../api.js';

const hoje = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long',
}).format(new Date());

export default function Dashboard({ dash, go }) {
  const [recent, setRecent] = useState({ proteses: [], ags: [] });
  useEffect(() => {
    Promise.all([api.get('/api/proteses').catch(() => ({ data: [] })), api.get('/api/agendamentos').catch(() => ({ data: [] }))])
      .then(([p, a]) => setRecent({ proteses: p.data.slice(0, 5), ags: a.data.slice(0, 5) }));
  }, []);

  return (
    <div className="dashboard-page">
      <section className="welcome-card">
        <div className="welcome-copy">
          <div className="welcome-label"><span /> ROTINA DA CLÍNICA</div>
          <h2>Um cuidado de cada vez.<br /><em>A clínica em boas mãos.</em></h2>
          <p>Organize conversas, avaliações e o andamento das próteses em um só lugar.</p>
          <div className="welcome-actions">
            <button className="btn welcome-primary" onClick={() => go('atendimento')}>Abrir atendimento <span aria-hidden="true">↗</span></button>
            <button className="btn welcome-secondary" onClick={() => go('agenda')}>Novo agendamento</button>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-date">{hoje}</div>
          <div className="tooth-orbit"><span>🦷</span></div>
          <div className="welcome-note"><span className="status-dot" /> Tudo em um só lugar</div>
        </div>
        <div className="welcome-orb welcome-orb-one" />
        <div className="welcome-orb welcome-orb-two" />
      </section>

      <div className="dashboard-heading">
        <div><span className="section-kicker">ACOMPANHAMENTO</span><h2>Resumo da clínica</h2></div>
        <span className="dashboard-date">{hoje}</span>
      </div>

      <div className="grid4 dashboard-stats">
        <div className="card stat stat-patients">
          <div className="stat-top"><span className="stat-icon">♙</span><span className="stat-caption">CADASTRO</span></div>
          <div className="label">Pacientes</div>
          <div className="value">{dash.totalPacientes ?? 0}</div>
          <div className="hint">pessoas acompanhadas</div>
        </div>
        <div className="card stat stat-agenda">
          <div className="stat-top"><span className="stat-icon">◷</span><span className="stat-caption">AGENDA</span></div>
          <div className="label">Aguardando confirmação</div>
          <div className="value">{dash.agendamentosPendentes ?? 0}</div>
          <div className="hint">avaliações e retornos</div>
        </div>
        <div className="card stat stat-prostheses">
          <div className="stat-top"><span className="stat-icon">✳</span><span className="stat-caption">LABORATÓRIO</span></div>
          <div className="label">Próteses em andamento</div>
          <div className="value">{dash.protesesEmAndamento ?? 0}</div>
          <div className="hint">da moldagem à entrega</div>
        </div>
        <div className="card stat stat-finance">
          <div className="stat-top"><span className="stat-icon">R$</span><span className="stat-caption">FINANCEIRO</span></div>
          <div className="label">Recebido até agora</div>
          <div className="value currency">R$ {dash.totalRecebido ?? 0}</div>
          <div className="hint">A receber: R$ {dash.totalAReceber ?? 0}</div>
        </div>
      </div>

      <div className="dashboard-heading list-heading">
        <div><span className="section-kicker">PRÓXIMAS ETAPAS</span><h2>O que merece atenção</h2></div>
      </div>
      <div className="grid2 dashboard-lists">
        <div className="card dashboard-list-card">
          <div className="page-head">
            <div><h2>Próximos agendamentos</h2><p>Os horários mais recentes da agenda</p></div>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => go('agenda')}>Ver agenda <span aria-hidden="true">→</span></button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th>Quando</th><th>Status</th></tr></thead>
              <tbody>
                {recent.ags.map(a => (
                  <tr key={a.id}><td><b>{a.pacienteNome || 'Paciente'}</b></td><td>{a.data || 'A combinar'}</td><td><span className={`pill ${a.status}`}>{a.status}</span></td></tr>
                ))}
                {recent.ags.length === 0 && <tr><td colSpan={3} className="muted">Nenhum agendamento por enquanto.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card dashboard-list-card">
          <div className="page-head">
            <div><h2>Próteses recentes</h2><p>Acompanhamento de produção e entrega</p></div>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => go('proteses')}>Ver produção <span aria-hidden="true">→</span></button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody>
                {recent.proteses.map(p => (
                  <tr key={p.id}><td><b>{p.paciente?.nome || 'Paciente'}</b></td><td>{p.tipo}</td><td><span className={`pill ${p.status}`}>{p.status}</span></td></tr>
                ))}
                {recent.proteses.length === 0 && <tr><td colSpan={3} className="muted">Nenhuma prótese em produção ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
