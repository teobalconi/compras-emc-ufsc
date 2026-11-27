import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ||
  'c_473bfaf8f332eb7ed994b00f8401a9719a50ae0817c307e64359e41b5779058d@group.calendar.google.com';

// Utilitários de data no fuso de Florianópolis (America/Sao_Paulo)
function getHojeBRT() {
  const isoBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m, d] = isoBRT.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parseDateUTC(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatBR(dateObj) {
  return dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatUnidades(valor) {
  const num = Number(valor);
  return Number.isInteger(num)
    ? num.toLocaleString('pt-BR')
    : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getRows(query, recurso) {
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao consultar ${recurso}: ${error.message}`);
  return data || [];
}

async function getDestinatarios(somentePrimeiro = false) {
  const data = await getRows(
    supabase
      .from('equipe')
      .select('email')
      .eq('ativo', true)
      .order('created_at', { ascending: true }),
    'equipe'
  );

  const emails = data.map((r) => r.email.trim()).filter(Boolean);
  if (!emails.length) throw new Error('Nenhum destinatário ativo encontrado na tabela equipe.');
  return somentePrimeiro ? [emails[0]] : emails;
}

async function enviarEmail({ fromName, to, subject, html, text }) {
  await transporter.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: to.join(', '),
    subject,
    text,
    html,
  });
  console.log(`✅ E-mail enviado [${subject}] para: ${to.join(', ')}`);
}

// ============================================================================
// MÓDULO 1: CRONOGRAMA (PLANEJAMENTO)
// ============================================================================

async function resumoMensalCronograma(modoTeste = false) {
  const hoje = getHojeBRT();
  const primeiroDiaMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const ultimoDiaMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
  const destinatarios = await getDestinatarios(modoTeste);

  let atividades = [];
  if (modoTeste) {
    atividades = [
      {
        etapa_nome: 'CRONOGRAMA 1ª ETAPA',
        atividade: 'Inserção das demandas (TESTE)',
        responsavel: 'Unidades',
        inicio: hoje,
        fim: new Date(hoje.getTime() + 5 * 86400000),
        dias_uteis: 5,
        diasRestantes: 0,
      },
    ];
  } else {
    const data = await getRows(supabase.from('cronograma_anual').select('*'), 'cronograma anual');
    atividades = data
      .map((item) => ({
        ...item,
        inicio: parseDateUTC(item.data_inicio),
        fim: parseDateUTC(item.data_fim),
      }))
      .filter((a) => a.inicio && a.inicio >= primeiroDiaMes && a.inicio <= ultimoDiaMes)
      .map((a) => ({
        ...a,
        diasRestantes: Math.ceil((a.inicio - hoje) / 86400000),
      }))
      .sort((a, b) => a.inicio - b.inicio);
  }

  if (!atividades.length) {
    console.log('✅ Nenhuma atividade inicia neste mês.');
    return;
  }

  const nomeMes = primeiroDiaMes.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const linhasHTML = atividades
    .map((a) => {
      const bg = a.diasRestantes <= 0 ? '#f8d7da' : a.diasRestantes <= 7 ? '#fff3cd' : '';
      return `<tr style="background-color: ${bg};">
        <td>${a.etapa_nome}</td>
        <td>${a.atividade}</td>
        <td style="text-align:center;">${a.responsavel}</td>
        <td style="text-align:center;">${formatBR(a.inicio)}</td>
        <td style="text-align:center;">${formatBR(a.fim)}</td>
        <td style="text-align:center;">${a.dias_uteis}</td>
        <td style="text-align:center;">${a.diasRestantes} dias</td>
      </tr>`;
    })
    .join('');

  const html = `<html><body>
    <h2>Resumo Mensal do Cronograma - ${nomeMes}</h2>
    <p>Prezados,</p>
    <p>Segue o resumo de <strong>todas as atividades que iniciarão no mês de ${nomeMes}</strong>:</p>
    <p><strong>Período analisado:</strong> ${formatBR(primeiroDiaMes)} a ${formatBR(ultimoDiaMes)}</p>
    <p><strong>Data de geração:</strong> ${formatBR(hoje)}</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr style="background-color:#007bff;color:white;">
        <th style="text-align:left;">Etapa</th><th style="text-align:left;">Atividade</th>
        <th>Responsável</th><th>Início</th><th>Término</th><th>Dias Úteis</th><th>Dias Restantes</th>
      </tr></thead>
      <tbody>${linhasHTML}</tbody>
    </table>
    <br><p><strong>Total de atividades a iniciar neste mês:</strong> ${atividades.length}</p>
    <p>Atenciosamente,<br>Sistema de Monitoramento de Cronograma</p>
    <hr><p style="font-size:10px;color:#666;">Este é um e-mail automático gerado pelo sistema (Resumo Mensal do Cronograma).</p>
  </body></html>`;

  await enviarEmail({
    fromName: 'Sistema de Monitoramento de Cronograma',
    to: destinatarios,
    subject: `[COMPRAS] Resumo Mensal: ${atividades.length} atividade(s) iniciam em ${nomeMes}`,
    html,
    text: `Resumo Mensal do Cronograma - ${nomeMes} (${atividades.length} atividades)`,
  });
}

async function alertaInicioAtividade(modoTeste = false) {
  const hoje = getHojeBRT();
  const destinatarios = await getDestinatarios(modoTeste);

  let atividades = [];
  if (modoTeste) {
    atividades = [
      {
        etapa_nome: 'CRONOGRAMA 1ª ETAPA',
        atividade: 'Inserção das demandas (TESTE)',
        responsavel: 'Unidades',
        inicio: hoje,
        fim: new Date(hoje.getTime() + 5 * 86400000),
        dias_uteis: 5,
      },
    ];
  } else {
    const data = await getRows(supabase.from('cronograma_anual').select('*'), 'cronograma anual');
    atividades = data
      .map((item) => ({
        ...item,
        inicio: parseDateUTC(item.data_inicio),
        fim: parseDateUTC(item.data_fim),
      }))
      .filter((a) => a.inicio && a.inicio.getTime() === hoje.getTime())
      .sort((a, b) => a.etapa_nome.localeCompare(b.etapa_nome));
  }

  if (!atividades.length) {
    console.log('✅ Nenhuma atividade inicia hoje.');
    return;
  }

  const dataStr = formatBR(hoje);
  const linhasHTML = atividades
    .map(
      (a) => `<tr style="background-color:#d4edda;">
        <td>${a.etapa_nome}</td>
        <td>${a.atividade}</td>
        <td style="text-align:center;">${a.responsavel}</td>
        <td style="text-align:center;"><strong>HOJE</strong></td>
        <td style="text-align:center;">${formatBR(a.fim)}</td>
        <td style="text-align:center;">${a.dias_uteis} dias</td>
      </tr>`
    )
    .join('');

  const html = `<html><body>
    <h2>Início de Atividade Hoje - ${dataStr}</h2>
    <p>Prezados,</p>
    <p>As seguintes atividades <strong>iniciam HOJE</strong> (${dataStr}):</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr style="background-color:#28a745;color:white;">
        <th style="text-align:left;">Etapa</th><th style="text-align:left;">Atividade</th>
        <th>Responsável</th><th>Início</th><th>Término</th><th>Dias Úteis</th>
      </tr></thead>
      <tbody>${linhasHTML}</tbody>
    </table>
    <br><p><strong>Total de atividades iniciando hoje:</strong> ${atividades.length}</p>
    <p style="color:#28a745;"><strong>✅ Lembrete:</strong> As atividades acima devem ser iniciadas conforme o planejamento do cronograma.</p>
    <p>Atenciosamente,<br>Sistema de Monitoramento de Cronograma</p>
    <hr><p style="font-size:10px;color:#666;">Este é um e-mail automático gerado pelo sistema (Alerta de Início de Atividade).</p>
  </body></html>`;

  await enviarEmail({
    fromName: 'Sistema de Monitoramento de Cronograma',
    to: destinatarios,
    subject: `[COMPRAS] INÍCIO HOJE: ${atividades.length} atividade(s) iniciam em ${dataStr}`,
    html,
    text: `Início de Atividade Hoje (${dataStr}) - ${atividades.length} atividade(s).`,
  });
}

async function alertaFimAtividade(modoTeste = false) {
  const hoje = getHojeBRT();
  const dataAlvo = new Date(hoje.getTime() + 7 * 86400000);
  const destinatarios = await getDestinatarios(modoTeste);

  let atividades = [];
  if (modoTeste) {
    atividades = [
      {
        etapa_nome: 'CRONOGRAMA 3ª ETAPA',
        atividade: 'Execução das tarefas (TESTE)',
        responsavel: 'Unidades',
        inicio: new Date(hoje.getTime() - 8 * 86400000),
        fim: dataAlvo,
        dias_uteis: 15,
        diasRestantes: 7,
      },
    ];
  } else {
    const data = await getRows(supabase.from('cronograma_anual').select('*'), 'cronograma anual');
    atividades = data
      .map((item) => ({
        ...item,
        inicio: parseDateUTC(item.data_inicio),
        fim: parseDateUTC(item.data_fim),
      }))
      .filter((a) => a.fim && a.fim.getTime() === dataAlvo.getTime())
      .map((a) => ({ ...a, diasRestantes: 7 }))
      .sort((a, b) => a.etapa_nome.localeCompare(b.etapa_nome));
  }

  if (!atividades.length) {
    console.log('✅ Nenhuma atividade termina em 7 dias.');
    return;
  }

  const dataFimStr = formatBR(atividades[0].fim);
  const linhasHTML = atividades
    .map(
      (a) => `<tr style="background-color:#fff3cd;">
        <td>${a.etapa_nome}</td>
        <td>${a.atividade}</td>
        <td style="text-align:center;">${a.responsavel}</td>
        <td style="text-align:center;">${formatBR(a.inicio)}</td>
        <td style="text-align:center;"><strong>${formatBR(a.fim)}</strong></td>
        <td style="text-align:center;">${a.dias_uteis} dias</td>
        <td style="text-align:center;"><strong>${a.diasRestantes} dias</strong></td>
      </tr>`
    )
    .join('');

  const html = `<html><body>
    <h2>⚠️ Alerta: Atividades terminando em 7 dias</h2>
    <p>Prezados,</p>
    <p>As seguintes atividades <strong>terminarão em 7 dias</strong> (${dataFimStr}):</p>
    <p><strong>Data de referência:</strong> ${formatBR(hoje)}</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr style="background-color:#dc3545;color:white;">
        <th style="text-align:left;">Etapa</th><th style="text-align:left;">Atividade</th>
        <th>Responsável</th><th>Início</th><th>Término</th><th>Dias Úteis</th><th>Dias Restantes</th>
      </tr></thead>
      <tbody>${linhasHTML}</tbody>
    </table>
    <br><p><strong>Total de atividades:</strong> ${atividades.length}</p>
    <p style="color:#dc3545;"><strong>⚠️ Atenção:</strong> Faltam apenas 7 dias para o término. Verifique se todas as tarefas serão concluídas dentro do prazo.</p>
    <p>Atenciosamente,<br>Sistema de Monitoramento de Cronograma</p>
    <hr><p style="font-size:10px;color:#666;">Este é um e-mail automático gerado pelo sistema (Alerta de Término de Atividade).</p>
  </body></html>`;

  await enviarEmail({
    fromName: 'Sistema de Monitoramento de Cronograma',
    to: destinatarios,
    subject: `[COMPRAS] ⚠️ ATENÇÃO: ${atividades.length} atividade(s) terminam em 7 dias - ${dataFimStr}`,
    html,
    text: `Alerta: ${atividades.length} atividade(s) terminam em 7 dias (${dataFimStr}).`,
  });
}

// ============================================================================
// MÓDULO 2: PREGÕES / SALDO ANUAL (EXECUÇÃO)
// ============================================================================

async function resumoMensalPregoes(modoTeste = false) {
  const hoje = getHojeBRT();
  const primeiroDiaMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const ultimoDiaMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
  const destinatarios = await getDestinatarios(modoTeste);

  let itens = [];
  if (modoTeste) {
    itens = [
      {
        descricao: 'ITEM TESTE 1 - Material de Escritório',
        dataVencimento: new Date(hoje.getTime() + 15 * 86400000),
        saldo: 1500.5,
        diasRestantes: 15,
      },
      {
        descricao: 'ITEM TESTE 2 - Equipamentos de TI',
        dataVencimento: new Date(hoje.getTime() + 28 * 86400000),
        saldo: 3000,
        diasRestantes: 28,
      },
    ];
  } else {
    const data = await getRows(
      supabase.from('saldo_anual').select('*').gt('saldo_setor', 0),
      'saldo anual'
    );
    itens = data
      .map((row) => ({
        descricao: `${row.edital_oficio} - ${row.descricao}`,
        dataVencimento: parseDateUTC(row.fim_vigencia),
        saldo: Number(row.saldo_setor),
      }))
      .filter((i) => i.dataVencimento && i.dataVencimento >= primeiroDiaMes && i.dataVencimento <= ultimoDiaMes)
      .map((i) => ({ ...i, diasRestantes: Math.ceil((i.dataVencimento - hoje) / 86400000) }))
      .sort((a, b) => a.dataVencimento - b.dataVencimento);
  }

  if (!itens.length) {
    console.log('✅ Nenhum pregão vence neste mês.');
    return;
  }

  const nomeMes = primeiroDiaMes.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const linhasHTML = itens
    .map((i) => {
      const bg = i.diasRestantes <= 7 ? '#f8d7da' : i.diasRestantes <= 15 ? '#fff3cd' : '';
      return `<tr style="background-color:${bg};">
        <td>${i.descricao}</td>
        <td style="text-align:center;">${formatBR(i.dataVencimento)}</td>
        <td style="text-align:center;">${i.diasRestantes} dias</td>
        <td style="text-align:right;">${formatUnidades(i.saldo)}</td>
      </tr>`;
    })
    .join('');

  const html = `<html><body>
    <h2>Resumo Mensal de Pregões - ${nomeMes}</h2>
    <p>Prezados,</p>
    <p>Segue o resumo mensal de <strong>todos os pregões que vencerão no mês de ${nomeMes}</strong> e que ainda possuem saldo disponível:</p>
    <p><strong>Período analisado:</strong> ${formatBR(primeiroDiaMes)} a ${formatBR(ultimoDiaMes)}</p>
    <p><strong>Data de geração:</strong> ${formatBR(hoje)}</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr style="background-color:#007bff;color:white;">
        <th style="text-align:left;">Item</th><th>Data de Vencimento</th>
        <th>Dias Restantes</th><th style="text-align:right;">Saldo (Unidades)</th>
      </tr></thead>
      <tbody>${linhasHTML}</tbody>
    </table>
    <br><p><strong>Total de pregões a vencer neste mês:</strong> ${itens.length}</p>
    <p>Atenciosamente,<br>Compras EMC</p>
    <hr><p style="font-size:10px;color:#666;">Este é um e-mail automático gerado pelo sistema (Resumo Mensal).</p>
  </body></html>`;

  await enviarEmail({
    fromName: 'Compras EMC',
    to: destinatarios,
    subject: `Resumo Mensal: ${itens.length} pregão(ões) a vencer em ${nomeMes}`,
    html,
    text: `Resumo Mensal: ${itens.length} pregão(ões) a vencer em ${nomeMes}.`,
  });
}

async function alerta30Dias(modoTeste = false) {
  const hoje = getHojeBRT();
  const dataAlvo = new Date(hoje.getTime() + 30 * 86400000);
  const destinatarios = await getDestinatarios(modoTeste);

  let itens = [];
  if (modoTeste) {
    itens = [
      { descricao: 'ITEM TESTE - Serviço de Manutenção', dataVencimento: dataAlvo, saldo: 2500 },
      { descricao: 'ITEM TESTE - Contrato de Suporte', dataVencimento: dataAlvo, saldo: 5000.75 },
    ];
  } else {
    const data = await getRows(
      supabase.from('saldo_anual').select('*').gt('saldo_setor', 0),
      'saldo anual'
    );
    itens = data
      .map((row) => ({
        descricao: `${row.edital_oficio} - ${row.descricao}`,
        dataVencimento: parseDateUTC(row.fim_vigencia),
        saldo: Number(row.saldo_setor),
      }))
      .filter((i) => i.dataVencimento && i.dataVencimento.getTime() === dataAlvo.getTime())
      .sort((a, b) => b.saldo - a.saldo);
  }

  if (!itens.length) {
    console.log('✅ Nenhum pregão vence exatamente em 30 dias.');
    return;
  }

  const dataVencStr = formatBR(itens[0].dataVencimento);
  const linhasHTML = itens
    .map(
      (i) => `<tr style="background-color:#fff3cd;">
        <td>${i.descricao}</td>
        <td style="text-align:center;">${formatBR(i.dataVencimento)}</td>
        <td style="text-align:center;"><strong>30 dias</strong></td>
        <td style="text-align:right;">${formatUnidades(i.saldo)}</td>
      </tr>`
    )
    .join('');

  const html = `<html><body>
    <h2>⚠️ Alerta: Pregões vencendo em 30 dias</h2>
    <p>Prezados,</p>
    <p>Os seguintes pregões <strong>vencerão exatamente em 30 dias</strong> (${dataVencStr}) e ainda possuem saldo disponível:</p>
    <p><strong>Data de referência:</strong> ${formatBR(hoje)}</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr style="background-color:#dc3545;color:white;">
        <th style="text-align:left;">Item</th><th>Data de Vencimento</th>
        <th>Prazo</th><th style="text-align:right;">Saldo (Unidades)</th>
      </tr></thead>
      <tbody>${linhasHTML}</tbody>
    </table>
    <br><p><strong>Total de itens:</strong> ${itens.length}</p>
    <p style="color:#dc3545;"><strong>⚠️ Ação necessária:</strong> Iniciar processo de renovação ou nova licitação imediatamente para evitar descontinuidade.</p>
    <p>Atenciosamente,<br>Compras EMC</p>
    <hr><p style="font-size:10px;color:#666;">Este é um e-mail automático gerado pelo sistema (Alerta de 30 dias).</p>
  </body></html>`;

  await enviarEmail({
    fromName: 'Compras EMC',
    to: destinatarios,
    subject: `⚠️ URGENTE: ${itens.length} pregão(ões) vencem em 30 dias - ${dataVencStr}`,
    html,
    text: `⚠️ URGENTE: ${itens.length} pregão(ões) vencem em 30 dias - ${dataVencStr}`,
  });
}

// ============================================================================
// MÓDULO 3: GOOGLE AGENDA (criarEvento, apagarEventos, apagarTodosEventosAnoAtual)
// ============================================================================

function getCalendarClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Secret GOOGLE_SERVICE_ACCOUNT_JSON não configurado.');
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

async function sincronizarGoogleAgenda() {
  const calendar = getCalendarClient();
  const atividades = await getRows(
    supabase.from('cronograma_anual').select('*'),
    'cronograma anual'
  );

  for (const item of atividades) {
    if (!item.data_inicio || !item.data_fim) continue;
    const titulo = `${item.etapa_nome}: ${item.atividade}`;
    const inicioISO = item.data_inicio.split('T')[0];

    const fimDate = parseDateUTC(item.data_fim);
    const fimExclusivo = new Date(fimDate.getTime() + 86400000).toISOString().split('T')[0];
    const fimDiaStr = item.data_fim.split('T')[0];

    const existentes = await calendar.events.list({
      calendarId: CALENDAR_ID,
      q: titulo,
      timeMin: `${inicioISO}T00:00:00Z`,
      timeMax: `${fimExclusivo}T23:59:59Z`,
    });

    if (!existentes.data.items?.some((e) => e.summary === titulo)) {
      await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: { summary: titulo, start: { date: inicioISO }, end: { date: fimExclusivo } },
      });
      console.log(`✅ Evento período criado: ${titulo}`);
    }

    const tituloFim = `${titulo} - FIM`;
    if (!existentes.data.items?.some((e) => e.summary === tituloFim)) {
      await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: { summary: tituloFim, start: { date: fimDiaStr }, end: { date: fimExclusivo } },
      });
      console.log(`✅ Evento FIM criado: ${tituloFim}`);
    }
  }
}

async function apagarEventosAgenda(apenasCronograma = true) {
  const calendar = getCalendarClient();
  const anoAtual = getHojeBRT().getUTCFullYear();
  const timeMin = apenasCronograma ? '2020-01-01T00:00:00Z' : `${anoAtual}-01-01T00:00:00Z`;
  const timeMax = apenasCronograma ? '2028-12-31T23:59:59Z' : `${anoAtual}-12-31T23:59:59Z`;

  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    maxResults: 2500,
    singleEvents: true,
  });

  let removidos = 0;
  for (const ev of res.data.items || []) {
    if (!apenasCronograma || (ev.summary && ev.summary.includes('CRONOGRAMA'))) {
      await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: ev.id });
      removidos++;
    }
  }
  console.log(`🗑️ Eventos removidos da agenda: ${removidos}`);
}

// ============================================================================
// ORQUESTRADOR DE EXECUÇÃO (CLI / GITHUB ACTIONS)
// ============================================================================

const comando = process.argv[2] || 'rotina-diaria';
const teste = process.argv[3] === 'true';

switch (comando) {
  case 'alerta-inicio':
    await alertaInicioAtividade(teste);
    break;
  case 'alerta-fim':
    await alertaFimAtividade(teste);
    break;
  case 'resumo-cronograma':
    await resumoMensalCronograma(teste);
    break;
  case 'resumo-pregoes':
    await resumoMensalPregoes(teste);
    break;
  case 'alerta-30dias':
    await alerta30Dias(teste);
    break;
  case 'agenda-sync':
    await sincronizarGoogleAgenda();
    break;
  case 'agenda-limpar-cronograma':
    await apagarEventosAgenda(true);
    break;
  case 'agenda-limpar-ano':
    await apagarEventosAgenda(false);
    break;
  case 'rotina-diaria':
  case 'rotina-diaria': {
    const hoje = getHojeBRT();
    await alertaInicioAtividade(false);
    await alertaFimAtividade(false);
    await alerta30Dias(false);
    if (hoje.getUTCDate() === 1) {
      await resumoMensalCronograma(false);
      await resumoMensalPregoes(false);
    }
    break;
  }
  default:
    throw new Error(`Comando de automação desconhecido: ${comando}`);
}
