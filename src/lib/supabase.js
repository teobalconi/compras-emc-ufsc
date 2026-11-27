import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Dispara manualmente qualquer workflow de automacao no GitHub Actions
 * (substitui a execucao manual das funcoes do Google Apps Script).
 */
export async function dispararAutomacaoGitHub(comando, modoTeste = false) {
  const token = import.meta.env.VITE_GITHUB_DISPATCH_TOKEN;
  const repo = import.meta.env.VITE_GITHUB_REPO;

  if (!token || !repo) {
    throw new Error(
      'Configure VITE_GITHUB_REPO e VITE_GITHUB_DISPATCH_TOKEN nas variáveis de ambiente (GitHub Secrets) para acionar automações pela interface.'
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/automacoes.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          comando,
          modo_teste: String(modoTeste),
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao acionar GitHub Actions (${res.status}): ${errText}`);
  }
}
