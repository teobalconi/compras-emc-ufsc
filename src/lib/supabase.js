import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    /^https?:\/\//i.test(supabaseUrl)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Dispara uma automacao por meio de uma Edge Function autenticada.
 * O token do GitHub fica somente nos secrets do Supabase, nunca no navegador.
 */
export async function dispararAutomacaoGitHub(comando, modoTeste = false) {
  if (!supabase) {
    throw new Error('Configure as variáveis do Supabase antes de acionar automações.');
  }

  const { error } = await supabase.functions.invoke('trigger-automation', {
    body: { command: comando, test: modoTeste },
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const details = await error.context.clone().json().catch(() => null);
      if (typeof details?.error === 'string') message = details.error;
    }
    throw new Error(`Falha ao acionar automação: ${message}`);
  }
}
