import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.get('/api/dashboard', asyncHandler(async (req, res) => {
  const proteses = await db.all('proteses');
  const lancs = await db.all('lancamentos');
  const recebido = lancs.filter((l) => l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  const aReceber = lancs.filter((l) => l.status !== 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  res.json({
    totalPacientes: (await db.all('pacientes')).length,
    agendamentosPendentes: (await db.all('agendamentos')).filter((a) => a.status === 'pendente').length,
    protesesEmAndamento: proteses.filter((p) => !['entregue'].includes(p.status)).length,
    protesesProntas: proteses.filter((p) => p.status === 'pronta').length,
    conversasAbertas: (await db.all('conversas')).filter((c) => (c.naoLidas || 0) > 0).length,
    totalRecebido: recebido, totalAReceber: aReceber
  });
}));

router.get('/api/relatorios', asyncHandler(async (req, res) => {
  const [proteses, ags, lancs, pacientes] = await Promise.all([
    db.all('proteses'), db.all('agendamentos'), db.all('lancamentos'), db.all('pacientes')
  ]);
  const porStatus = {};
  for (const p of proteses) porStatus[p.status] = (porStatus[p.status] || 0) + 1;
  const agPorStatus = {};
  for (const a of ags) agPorStatus[a.status] = (agPorStatus[a.status] || 0) + 1;
  const porForma = {};
  let recebido = 0, aReceber = 0;
  for (const l of lancs) {
    if (l.status === 'pago') { recebido += Number(l.valor || 0); porForma[l.forma || 'outro'] = (porForma[l.forma || 'outro'] || 0) + Number(l.valor || 0); }
    else aReceber += Number(l.valor || 0);
  }
  res.json({
    totalProteses: proteses.length, porStatus, agPorStatus, porForma, recebido, aReceber,
    faltas: ags.filter((a) => a.status === 'cancelado').length,
    totalAg: ags.length,
    taxaComparecimento: ags.length ? Math.round((ags.filter((a) => a.status === 'confirmado').length / ags.length) * 100) : 0,
    totalPacientes: pacientes.length
  });
}));

router.get('/api/health', (req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  now: new Date().toISOString(),
  banco: process.env.SUPABASE_URL ? 'supabase' : process.env.DATABASE_URL ? 'postgres' : 'sqlite'
}));

export default router;
