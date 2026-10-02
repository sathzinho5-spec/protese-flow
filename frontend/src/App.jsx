import { useEffect, useState } from 'react';
import Atendimento from './pages/Atendimento.jsx';
import Pacientes from './pages/Pacientes.jsx';
import Proteses from './pages/Proteses.jsx';
import Agenda from './pages/Agenda.jsx';
import Config from './pages/Config.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Financeiro from './pages/Financeiro.jsx';
import Equipe from './pages/Equipe.jsx';
import Relatorios from './pages/Relatorios.jsx';
import PosEntrega from './pages/PosEntrega.jsx';
import Logs from './pages/Logs.jsx';
import Agentes from './pages/Agentes.jsx';
import IAs from './pages/IAs.jsx';
import Monitor from './pages/Monitor.jsx';
import Login from './pages/Login.jsx';
import { api } from './api.js';
import { Toaster } from './components/ui.jsx';
import './styles.css';

const TABS = {
  dashboard: { title: 'Visão geral', sub: 'Acompanhe a clínica em tempo real' },
  atendimento: { title: 'Atendimento', sub: 'Inbox WhatsApp — agentes + CONFIRMO/REMARCAR' },
  agenda: { title: 'Agenda', sub: 'Avaliações, provas e entregas' },
  pacientes: { title: 'Pacientes', sub: 'Cadastro e histórico' },
  proteses: { title: 'Próteses + Fotos', sub: 'Do orçamento à entrega, com evolução' },
  financeiro: { title: 'Financeiro', sub: 'Entradas, saldo e recibos PDF' },
  relatorios: { title: 'Relatórios', sub: 'Produção, faltas e faturamento' },
  pos: { title: 'Pós-entrega', sub: 'Revisões e garantia automáticas' },
  agentes: { title: 'Agentes IA', sub: 'Prompts, funções e roteamento' },
  ias: { title: 'Introduzir IAs', sub: 'Provedores, chaves e vínculo' },
  monitor: { title: 'Painel WhatsApp', sub: 'Acompanhe conversas ao vivo' },
  equipe: { title: 'Equipe', sub: 'Atendentes e acessos' },
  logs: { title: 'Auditoria', sub: 'Quem fez o quê (admin)' },
  config: { title: 'Conexão WhatsApp', sub: 'Pareamento e instância' },
};

export default function App() {
  const [aba, setAba] = useState('dashboard');
  const [dash, setDash] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pf_user')); } catch { return null; }
  });
  const logado = !!localStorage.getItem('pf_token');

  const refresh = () => { if (localStorage.getItem('pf_token')) api.get('/api/dashboard').then(r => setDash(r.data)).catch(() => {}); };
  useEffect(() => {
    if (!logado) return;
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [logado]);

  if (!logado) return <Login onOk={() => { setUser(JSON.parse(localStorage.getItem('pf_user'))); refresh(); }} />;

  const sair = () => { localStorage.removeItem('pf_token'); localStorage.removeItem('pf_user'); location.reload(); };
  const go = (t) => { setAba(t); setMenuOpen(false); };

  const NAV = [
    { sec: 'Principal' },
    { key: 'dashboard', icon: '📊', nome: 'Dashboard' },
    { key: 'atendimento', icon: '💬', nome: 'Atendimento', count: dash.conversasAbertas },
    { key: 'monitor', icon: '📡', nome: 'Painel WA', count: dash.conversasAbertas },
    { key: 'agenda', icon: '📅', nome: 'Agenda', count: dash.agendamentosPendentes },
    { sec: 'Clínica' },
    { key: 'pacientes', icon: '👥', nome: 'Pacientes', count: dash.totalPacientes },
    { key: 'proteses', icon: '🦷', nome: 'Próteses', count: dash.protesesEmAndamento },
    { key: 'financeiro', icon: '💰', nome: 'Financeiro' },
    { key: 'relatorios', icon: '📈', nome: 'Relatórios' },
    { key: 'pos', icon: '🛡️', nome: 'Pós-entrega' },
    { key: 'agentes', icon: '🤖', nome: 'Agentes' },
    { key: 'ias', icon: '🧠', nome: 'IAs' },
    { sec: 'Sistema' },
    { key: 'equipe', icon: '🧑‍⚕️', nome: 'Equipe' },
    ...(user?.papel === 'admin' ? [{ key: 'logs', icon: '🕵️', nome: 'Auditoria' }] : []),
    { key: 'config', icon: '⚙️', nome: 'WhatsApp' },
  ];
  const BOTTOM = ['dashboard', 'atendimento', 'agenda', 'proteses', 'monitor'];
  const bottomItems = NAV.filter((n) => BOTTOM.includes(n.key));

  return (
    <div className="app">
      <Toaster />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🦷</div>
          <div>
            <h2>PróteseFácil</h2>
            <small>{user?.nome || 'Clínica'} • {user?.papel || ''}</small>
          </div>
        </div>

        <div className="nav">
          {NAV.map((n, i) => n.sec
            ? <div key={i} className="nav-label">{n.sec}</div>
            : <button key={n.key} className={aba === n.key ? 'active' : ''} onClick={() => go(n.key)}>{n.icon} {n.nome} {n.count ? <span className="count">{n.count}</span> : null}</button>
          )}
        </div>

        <div className="side-card">
          <div className="small">👤 {user?.nome}</div>
          <p className="small muted">Recebido: <b style={{ color: '#fff' }}>R$ {dash.totalRecebido ?? 0}</b></p>
          <p className="small muted">A receber: <b style={{ color: '#fff' }}>R$ {dash.totalAReceber ?? 0}</b></p>
          <button className="btn btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={sair}>Sair</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
          <div className="top-title">
            <h1>{TABS[aba].title}</h1>
            <div className="sub">{TABS[aba].sub}</div>
          </div>
          <div className="top-search">
            <span className="pill confirmado hide-mobile">● WhatsApp</span>
            <button className="btn btn-primary top-cta" onClick={() => go('agenda')}>+ <span className="hide-mobile">Novo agendamento</span><span className="only-mobile">Agendar</span></button>
          </div>
        </div>
        <div className="content">
          {aba === 'dashboard' && <Dashboard dash={dash} go={setAba} />}
          {aba === 'atendimento' && <Atendimento />}
          {aba === 'agenda' && <Agenda />}
          {aba === 'pacientes' && <Pacientes />}
          {aba === 'proteses' && <Proteses />}
          {aba === 'financeiro' && <Financeiro />}
          {aba === 'relatorios' && <Relatorios />}
          {aba === 'pos' && <PosEntrega />}
          {aba === 'agentes' && <Agentes />}
          {aba === 'ias' && <IAs />}
          {aba === 'monitor' && <Monitor />}
          {aba === 'equipe' && <Equipe />}
          {aba === 'logs' && <Logs />}
          {aba === 'config' && <Config />}
        </div>
        <nav className="bottomnav only-mobile">
          {bottomItems.map((n) => (
            <button key={n.key} className={aba === n.key ? 'active' : ''} onClick={() => go(n.key)}>
              <span className="b-icon">{n.icon}</span>
              <span className="b-label">{n.nome.split(' ')[0]}</span>
              {n.count ? <span className="b-count">{n.count}</span> : null}
            </button>
          ))}
          <button className={menuOpen ? 'active' : ''} onClick={() => setMenuOpen(true)}>
            <span className="b-icon">☰</span><span className="b-label">Mais</span>
          </button>
        </nav>
      </div>
      {menuOpen && (
        <div className="drawer-root only-mobile" onClick={() => setMenuOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="brand">
              <div className="brand-logo">🦷</div>
              <div><h2>PróteseFácil</h2><small>{user?.nome} • {user?.papel}</small></div>
              <button className="icon-btn" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="nav">
              {NAV.map((n, i) => n.sec
                ? <div key={i} className="nav-label">{n.sec}</div>
                : <button key={n.key} className={aba === n.key ? 'active' : ''} onClick={() => go(n.key)}>{n.icon} {n.nome} {n.count ? <span className="count">{n.count}</span> : null}</button>
              )}
            </div>
            <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={sair}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}
