import axios from 'axios';
import { io } from 'socket.io-client';

// Em produção (Vercel), o backend está em outra URL — usa VITE_API_URL.
// Em dev, o Vite proxya /api para o backend local.
const API_ORIGIN = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: API_ORIGIN });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('pf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pf_token');
      localStorage.removeItem('pf_user');
      if (!err.config?.url?.includes('/api/auth/')) location.reload();
    }
    throw err;
  }
);

export const socket = io(API_ORIGIN, { transports: ['websocket', 'polling'] });
export const uploadsUrl = (u) => (!u ? '' : u.startsWith('http') ? u : `${API_ORIGIN}${u}`);
export const backendUrl = (p) => `${API_ORIGIN}${p}`;
export const authUrl = (p) => {
  const t = localStorage.getItem('pf_token');
  return t ? `${API_ORIGIN}${p}${p.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}` : `${API_ORIGIN}${p}`;
};
export const apiError = (e, fallback = 'Algo deu errado') => e?.response?.data?.error || fallback;
