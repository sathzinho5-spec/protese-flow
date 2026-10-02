import { useCallback, useEffect, useRef, useState } from 'react';
import { api, socket } from './api.js';

// Lista remota com refresh manual + loading/erro padronizados
export function useApiList(url, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const refresh = useCallback(() => {
    setLoading(true);
    return api.get(url)
      .then((r) => { setData(r.data); setErro(''); })
      .catch((e) => setErro(e.response?.data?.error || 'Falha ao carregar'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, erro, refresh, setData };
}

// Inscreve eventos socket uma única vez (handler estável via ref — evita
// re-subscribe a cada render, que era o vazamento nas telas de chat)
export function useSocket(events, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const evts = Array.isArray(events) ? events : [events];
    const wrapped = (...args) => ref.current(...args);
    evts.forEach((e) => socket.on(e, wrapped));
    return () => evts.forEach((e) => socket.off(e, wrapped));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(events)]);
}
