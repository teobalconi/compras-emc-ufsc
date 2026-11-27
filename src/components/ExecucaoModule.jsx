import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { Upload, Plus, Search } from 'lucide-react';

function parseNumeroBR(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const limpo = String(val).replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function parseDataBRtoISO(str) {
  if (!str) return null;
  const limpo = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  const partes = limpo.split('/');
  if (partes.length === 3) {
    const [d, m, y] = partes;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export default function ExecucaoModule() {
  const [aba, setAba] = useState('saldo'); // 'saldo' | 'execucao' | 'atas'
  const [saldos, setSaldos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [atas, setAtas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [novoPedido, setNovoPedido] = useState({
    saldo_item_id: '',
    solicitante: '',
    laboratorio_setor: '',
    quantidade: 1,
    numero_sd_empenho: '',
    status: 'Solicitado',
    observacao: '',
  });

  useEffect(() => {
    carregar();
  }, [aba]);

  async function carregar() {
    const [{ data: dSaldos }, { data: dPedidos }, { data: dAtas }] = await Promise.all([
      supabase.from('saldo_anual').select('*').order('fim_vigencia'),
      supabase
        .from('execucao_pedidos')
        .select('*, saldo_anual(edital_oficio, item, descricao, unidade)')
        .order('data_pedido', { ascending: false }),
      supabase.from('atas_vigentes').select('*'),
    ]);
    setSaldos(dSaldos || []);
    setPedidos(dPedidos || []);
    setAtas(dAtas || []);
  }

  async function registrarPedido(e) {
    e.preventDefault();
    const { error } = await supabase.from('execucao_pedidos').insert([
      { ...novoPedido, quantidade: Number(novoPedido.quantidade) },
    ]);
    if (error) {
      alert('Erro ao registrar pedido: ' + error.message);
      return;
    }
    setNovoPedido({
      saldo_item_id: '',
      solicitante: '',
      laboratorio_setor: '',
      quantidade: 1,
      numero_sd_empenho: '',
      status: 'Solicitado',
      observacao: '',
    });
    carregar();
  }

  async function atualizarStatusPedido(id, novoStatus) {
    await supabase.from('execucao_pedidos').update({ status: novoStatus }).eq('id', id);
    carregar();
  }

  function importarSaldoCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const registros = results.data
          .filter((r) => r['Descrição'] || r['descricao'])
          .map((r) => ({
            setor: r['Setor'] || 'EMC/CTC',
            edital_oficio: r['Nº edital/ofício'] || r['edital_oficio'] || '',
            item: String(r['Item'] || r['item'] || ''),
            codigo: r['Código'] || r['codigo'] || '',
            unidade: r['Unid.'] || r['unidade'] || 'UN',
            descricao: r['Descrição'] || r['descricao'] || '',
            licitado: parseNumeroBR(r['Licitado']),
            saldo_total: parseNumeroBR(r['Saldo total']),
            qt_def_setor: parseNumeroBR(r['Qt. def. setor']),
            saldo_setor: parseNumeroBR(r['Saldo Setor']),
            valor_unitario: parseNumeroBR(r['Valor unit.']),
            fim_vigencia: parseDataBRtoISO(r['Fim vigência']) || '2026-12-31',
            detalhamento: r['Detalhamento do item'] || '',
          }));

        if (!registros.length) {
          alert('Nenhuma linha válida encontrada no CSV de Saldo Anual.');
          return;
        }

        const { error } = await supabase.from('saldo_anual').insert(registros);
        if (error) alert('Erro ao importar: ' + error.message);
        else {
          alert(`✅ ${registros.length} itens importados para Saldo Anual!`);
          carregar();
        }
        e.target.value = '';
      },
    });
  }

  const saldosFiltrados = saldos.filter((s) =>
    `${s.edital_oficio} ${s.codigo} ${s.descricao} ${s.setor}`
      .toLowerCase()
      .includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'saldo', label: 'Saldo Anual' },
          { id: 'execucao', label: 'Execução (Pedidos / Empenhos)' },
          { id: 'atas', label: 'Atas Vigentes' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              aba === t.id
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'saldo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Filtrar por pregão/edital, código ou descrição..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs w-full bg-white"
              />
            </div>
            <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Importar CSV Saldo Anual
              <input type="file" accept=".csv" onChange={importarSaldoCSV} className="hidden" />
            </label>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full text-xs divide-y divide-slate-200">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2.5 text-left">Setor</th>
                  <th className="p-2.5 text-left">Nº Edital/Ofício</th>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5">Código</th>
                  <th className="p-2.5">Unid.</th>
                  <th className="p-2.5 text-left">Descrição</th>
                  <th className="p-2.5 text-right">Licitado</th>
                  <th className="p-2.5 text-right">Saldo Total</th>
                  <th className="p-2.5 text-right">Qt. Def. Setor</th>
                  <th className="p-2.5 text-right">Saldo Setor</th>
                  <th className="p-2.5 text-right">Valor Unit.</th>
                  <th className="p-2.5">Fim Vigência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {saldosFiltrados.map((s) => {
                  const dias = Math.ceil((new Date(s.fim_vigencia + 'T00:00:00') - new Date()) / 86400000);
                  const corVigencia =
                    dias <= 15
                      ? 'bg-red-100 text-red-800'
                      : dias <= 30
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-50 text-emerald-800';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-2">{s.setor}</td>
                      <td className="p-2 font-mono whitespace-nowrap">{s.edital_oficio}</td>
                      <td className="p-2 text-center">{s.item}</td>
                      <td className="p-2 font-mono whitespace-nowrap">{s.codigo}</td>
                      <td className="p-2 text-center">{s.unidade}</td>
                      <td className="p-2 font-medium" title={s.detalhamento}>{s.descricao}</td>
                      <td className="p-2 text-right">{s.licitado}</td>
                      <td className="p-2 text-right">{s.saldo_total}</td>
                      <td className="p-2 text-right">{s.qt_def_setor}</td>
                      <td className="p-2 text-right font-bold text-blue-700">{s.saldo_setor}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {Number(s.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className={`p-2 text-center font-semibold whitespace-nowrap ${corVigencia}`}>
                        {new Date(s.fim_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')} ({dias}d)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'execucao' && (
        <div className="space-y-4">
          <form
            onSubmit={registrarPedido}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 text-xs"
          >
            <select
              value={novoPedido.saldo_item_id}
              onChange={(e) => setNovoPedido({ ...novoPedido, saldo_item_id: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg col-span-2"
              required
            >
              <option value="">Selecione o item do Saldo Anual...</option>
              {saldos
                .filter((s) => Number(s.saldo_setor) > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.edital_oficio} | Item {s.item} - {s.descricao} (Saldo: {s.saldo_setor})
                  </option>
                ))}
            </select>
            <input
              placeholder="Solicitante *"
              value={novoPedido.solicitante}
              onChange={(e) => setNovoPedido({ ...novoPedido, solicitante: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
              required
            />
            <input
              placeholder="Lab / Setor"
              value={novoPedido.laboratorio_setor}
              onChange={(e) => setNovoPedido({ ...novoPedido, laboratorio_setor: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Quantidade *"
              value={novoPedido.quantidade}
              onChange={(e) => setNovoPedido({ ...novoPedido, quantidade: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
              required
            />
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg p-2 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Abater Saldo
            </button>
          </form>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full text-xs divide-y divide-slate-200">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2.5">Data</th>
                  <th className="p-2.5 text-left">Edital / Item</th>
                  <th className="p-2.5 text-left">Solicitante</th>
                  <th className="p-2.5 text-left">Lab/Setor</th>
                  <th className="p-2.5 text-right">Qtd.</th>
                  <th className="p-2.5">Nº SD / Empenho</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2 text-center">
                      {new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-2">
                      {p.saldo_anual?.edital_oficio} - {p.saldo_anual?.descricao}
                    </td>
                    <td className="p-2">{p.solicitante}</td>
                    <td className="p-2">{p.laboratorio_setor || '-'}</td>
                    <td className="p-2 text-right font-semibold">{p.quantidade}</td>
                    <td className="p-2 text-center">{p.numero_sd_empenho || '-'}</td>
                    <td className="p-2 text-center">
                      <select
                        value={p.status}
                        onChange={(e) => atualizarStatusPedido(p.id, e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="Solicitado">Solicitado</option>
                        <option value="Empenhado">Empenhado</option>
                        <option value="Entregue">Entregue</option>
                        <option value="Cancelado">Cancelado (estorna saldo)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'atas' && (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
          <table className="min-w-full text-xs divide-y divide-slate-200">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-2.5 text-left">Nº Edital / Pregão</th>
                <th className="p-2.5">Setor</th>
                <th className="p-2.5">Fim Vigência</th>
                <th className="p-2.5">Dias Restantes</th>
                <th className="p-2.5">Qtd. Itens</th>
                <th className="p-2.5 text-right">Saldo Financeiro Setor</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {atas.map((a, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono font-semibold">{a.edital_oficio}</td>
                  <td className="p-2.5 text-center">{a.setor}</td>
                  <td className="p-2.5 text-center">
                    {new Date(a.fim_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-2.5 text-center">{a.dias_restantes} dias</td>
                  <td className="p-2.5 text-center">{a.total_itens}</td>
                  <td className="p-2.5 text-right font-semibold">
                    {Number(a.valor_saldo_disponivel).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.status_ata === 'Vencida'
                          ? 'bg-red-100 text-red-800'
                          : a.status_ata === 'Vence em 30 dias'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {a.status_ata}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
