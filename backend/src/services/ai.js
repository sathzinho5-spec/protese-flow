import axios from 'axios';
import { db } from '../db.js';
import { logger } from '../logger.js';

// Central de IAs: múltiplos provedores OpenAI-compatible (OpenAI, Gemini compat,
// Groq, Ollama, custom). A chave nunca volta cheia na API.

export const PROVIDER_PRESETS = {
  openai: { nome: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  gemini: { nome: 'Gemini (modo compatível)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
  groq: { nome: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b'] },
  ollama: { nome: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', models: ['llama3.1', 'qwen2.5'] },
  custom: { nome: 'Custom (OpenAI-compatível)', baseUrl: '', models: [] },
};

function masked(list) {
  return list.map((p) => ({ ...p, apiKey: undefined, apiKeySet: !!p.apiKey, apiKeyTail: p.apiKey ? String(p.apiKey).slice(-4) : '' })).reverse();
}

export async function seedProviders() {
  // migra o cérebro antigo (agent_settings) para providers, uma vez
  try {
    const old = (await db.all('agent_settings'))[0];
    if (old?.apiKey && (await db.all('providers')).length === 0) {
      await db.insert('providers', {
        nome: 'Principal (migrada)', tipo: old.provider || 'openai',
        baseUrl: old.baseUrl || PROVIDER_PRESETS[old.provider]?.baseUrl || PROVIDER_PRESETS.openai.baseUrl,
        model: old.model || 'gpt-4o-mini', apiKey: old.apiKey, ativo: true, padrao: true
      });
      logger.info('[ias] agent_settings migrado para providers');
    }
    if ((await db.all('providers')).length === 0) {
      await db.insert('providers', {
        nome: 'Ollama local (exemplo)', tipo: 'ollama',
        baseUrl: PROVIDER_PRESETS.ollama.baseUrl, model: 'llama3.1',
        apiKey: 'ollama', ativo: false, padrao: false
      });
    }
  } catch (e) { logger.error('[ias] seed falhou', e.message); }
}

export async function activeProviders() {
  return (await db.all('providers')).filter((p) => p.ativo && p.apiKey);
}

export async function defaultProvider() {
  const all = await activeProviders();
  return all.find((p) => p.padrao) || all[0] || null;
}

export async function chatComplete({ system, user, providerId, maxTokens = 400, temperature = 0.3 }) {
  const prov = providerId ? await db.find('providers', providerId) : await defaultProvider();
  if (!prov?.apiKey) return null;
  const r = await axios.post(`${prov.baseUrl}/chat/completions`, {
    model: prov.model, temperature, max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
  }, { headers: { Authorization: `Bearer ${prov.apiKey}` }, timeout: 25000 });
  return { text: r.data.choices?.[0]?.message?.content?.trim() || null, provider: prov };
}

export async function testProvider(id) {
  const prov = await db.find('providers', id);
  if (!prov) throw Object.assign(new Error('Provedor não encontrado'), { status: 404 });
  const t0 = Date.now();
  try {
    const out = await chatComplete({
      system: 'Responda exatamente: OK',
      user: 'Teste de conexão. Responda OK.',
      // Reasoning models may use a small token budget before producing visible text.
      providerId: id, maxTokens: 120
    });
    if (!out?.text) throw new Error('Sem resposta do modelo');
    await db.update('providers', id, { ultimoTeste: new Date().toISOString(), ultimoStatus: 'ok' });
    return { ok: true, latenciaMs: Date.now() - t0, resposta: out.text.slice(0, 200), model: prov.model };
  } catch (e) {
    const detalhe = e.response?.data?.error?.message || e.response?.data?.message || e.message;
    await db.update('providers', id, { ultimoTeste: new Date().toISOString(), ultimoStatus: 'erro: ' + String(detalhe).slice(0, 120) });
    throw Object.assign(new Error('Falha no teste: ' + detalhe), { status: 502 });
  }
}

export { masked };
