import { useEffect, useState } from 'react';

let pushToast;
export function toast(msg, tipo = 'ok') {
  if (pushToast) pushToast(msg, tipo);
  else alert(msg);
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (msg, tipo) => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l, { id, msg, tipo }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3200);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="toasts">
      {items.map((t) => <div key={t.id} className={`toast ${t.tipo}`}>{t.msg}</div>)}
    </div>
  );
}

export function Card({ children, style }) {
  return <div className="card" style={style}>{children}</div>;
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export function Pill({ value }) {
  return <span className={`pill ${value}`}>{value}</span>;
}

export function Stat({ tone = '', label, value, hint, action }) {
  return (
    <div className={`card stat ${tone}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint} {action}</div>
    </div>
  );
}

export function Empty({ icon = '📭', title, sub }) {
  return <div className="empty"><div style={{ fontSize: 32 }}>{icon}</div><b>{title}</b>{sub && <span className="small muted">{sub}</span>}</div>;
}

export function initials(name) {
  return String(name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}
