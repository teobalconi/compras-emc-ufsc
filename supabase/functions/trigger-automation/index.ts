import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedCommands = new Set([
  'rotina-diaria',
  'alerta-inicio',
  'alerta-fim',
  'resumo-cronograma',
  'resumo-pregoes',
  'alerta-30dias',
  'agenda-sync',
  'agenda-limpar-cronograma',
  'agenda-limpar-ano',
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const githubToken = Deno.env.get('GITHUB_ACTIONS_TOKEN');
  const repository = Deno.env.get('GITHUB_REPOSITORY');
  if (!supabaseUrl || !serviceRoleKey || !githubToken || !repository) {
    console.error('Configuração obrigatória ausente para trigger-automation.');
    return jsonResponse({ error: 'A integração de automação não está configurada.' }, 500);
  }

  const match = repository.match(/^([^/]+)\/([^/]+)$/);
  if (!match) {
    console.error('GITHUB_REPOSITORY deve estar no formato owner/repository.');
    return jsonResponse({ error: 'Configuração inválida do repositório GitHub.' }, 500);
  }

  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse({ error: 'Autenticação obrigatória.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  const email = userData.user?.email;
  if (userError || !email) {
    return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
  }

  const { data: member, error: memberError } = await adminClient
    .from('equipe')
    .select('id')
    .ilike('email', email)
    .eq('ativo', true)
    .maybeSingle();
  if (memberError) {
    console.error('Falha ao verificar a equipe autorizada:', memberError.message);
    return jsonResponse({ error: 'Não foi possível verificar sua autorização.' }, 500);
  }
  if (!member) {
    return jsonResponse({ error: 'Usuário sem autorização para acionar automações.' }, 403);
  }

  let input: { command?: unknown; test?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Corpo JSON inválido.' }, 400);
  }

  if (typeof input.command !== 'string' || !allowedCommands.has(input.command)) {
    return jsonResponse({ error: 'Comando de automação inválido.' }, 400);
  }
  if (input.test !== undefined && typeof input.test !== 'boolean') {
    return jsonResponse({ error: 'O campo test deve ser booleano.' }, 400);
  }

  const githubUrl = `https://api.github.com/repos/${match[1]}/${match[2]}/actions/workflows/automacoes.yml/dispatches`;
  const githubResponse = await fetch(githubUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        comando: input.command,
        modo_teste: String(input.test === true),
      },
    }),
  });

  if (!githubResponse.ok) {
    const details = await githubResponse.text();
    console.error(`GitHub Actions recusou o despacho (${githubResponse.status}): ${details}`);
    return jsonResponse(
      { error: `GitHub Actions recusou o despacho (HTTP ${githubResponse.status}).` },
      502,
    );
  }

  return jsonResponse({ message: 'Automação enviada ao GitHub Actions.' });
});
