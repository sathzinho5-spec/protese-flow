import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onOk }) {
  const [modo, setModo] = useState('login'); // login | register
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErro('E-mail inválido — confira: nome@clinica.com');
      return;
    }
    if (!form.senha) { setErro('Digite sua senha'); return; }
    setErro(''); setLoading(true);
    try {
      const url = modo === 'login' ? '/api/auth/login' : '/api/auth/register';
      const r = await api.post(url, { ...form, email });
      localStorage.setItem('pf_token', r.data.token);
      localStorage.setItem('pf_user', JSON.stringify({ nome: r.data.nome, email: r.data.email, papel: r.data.papel }));
      onOk();
    } catch (err) {
      const msg = err.response?.data?.error || 'Falha ao entrar';
      setErro(typeof msg === 'string' ? msg : 'Verifique os dados e tente de novo');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-logo" style={{ width: 52, height: 52, fontSize: 28 }}>🦷</div>
        <h2>PróteseFácil</h2>
        <p className="muted small">Atendimento WhatsApp da clínica</p>
        <div className="form-row" style={{ justifyContent: 'center', margin: '12px 0' }}>
          <button className={`btn btn-sm ${modo === 'login' ? 'btn-primary' : ''}`} onClick={() => setModo('login')}>Entrar</button>
          <button className={`btn btn-sm ${modo === 'register' ? 'btn-primary' : ''}`} onClick={() => setModo('register')}>Criar conta</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modo === 'register' && <input placeholder="Nome *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />}
          <input placeholder="E-mail *" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Senha *" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required />
          {erro && <div className="pill cancelado">{erro}</div>}
          <button className="btn btn-primary" disabled={loading}>{loading ? '...' : modo === 'login' ? 'Entrar →' : 'Criar primeiro acesso (admin)'}</button>
        </form>
        <p className="small muted" style={{ marginTop: 12 }}>Primeira conta criada vira <b>admin</b>. Depois cadastre atendentes em Equipe.</p>
      </div>
    </div>
  );
}
