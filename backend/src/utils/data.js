// P0-3: converte texto livre ("10/10 14h", "12/10 manhã") em ISO para
// ordenar e lembrar de verdade, mantendo o texto original p/ exibição.
export function parseDataAgendamento(texto, ref = new Date()) {
  if (!texto || typeof texto !== 'string') return null;
  const t = texto.toLowerCase();
  const m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  let dia = Number(m[1]), mes = Number(m[2]) - 1;
  let ano = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : ref.getFullYear();
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
  let hora = 9, min = 0;
  const hm = t.match(/(\d{1,2})(?::(\d{2}))?\s*h/);
  if (hm) { hora = Math.min(23, Number(hm[1])); min = hm[2] ? Number(hm[2]) : 0; }
  else if (/manh/.test(t)) hora = 9;
  else if (/tarde/.test(t)) hora = 15;
  else if (/noite/.test(t)) hora = 19;
  let d = new Date(ano, mes, dia, hora, min);
  if (!m[3] && d < ref) d = new Date(ano + 1, mes, dia, hora, min); // data passada → próximo ano
  return isNaN(d.getTime()) ? null : d.toISOString();
}
