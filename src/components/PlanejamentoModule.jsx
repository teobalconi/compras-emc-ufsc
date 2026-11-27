import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase, dispararAutomacaoGitHub } from '../lib/supabase';
import { parseNumeroBR, formatBRL } from '../lib/utils';
import { Calendar, Trash2, Upload, Plus, Search, RefreshCw, Download, Pencil, X } from 'lucide-react';

const CAMPOS_INICIAIS = {
  num_item: '',
  qtd_total: '',
  processo: '',
  responsavel_pesquisa: 'EMC',
  item_comp: 'Não',
  item_excl: '',
  dem_excl: '',
  pecul: '',
  cod_siasg: '',
  codigo_item: '',
  unidade_medida: 'UN',
  descricao_resumida: '',
  especificacao: '',
  detalhamento: '',
  valor_unitario: '',
  emc_ctc: '',
  sd: '',
};

export default function PlanejamentoModule() {
  const [aba, setAba] = useState('etapa-1'); // 'etapa-1'..'etapa-5' | 'cronograma'
  const [itens, setItens] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [novoItem, setNovoItem] = useState(CAMPOS_INICIAIS);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const etapaAtual = aba.startsWith('etapa-') ? Number(aba.split('-')[1]) : null;

  useEffect(() => {
    setEditandoId(null);
    setNovoItem(CAMPOS_INICIAIS);
    carregarDados();
  }, [aba]);

  async function carregarDados() {
    setLoading(true);
    if (etapaAtual) {
      const [{ data: dItens, error: errItens }, { data: dGrupos, error: errGrupos }] = await Promise.all([
        supabase.from('planejamento_itens').select('*').eq('etapa', etapaAtual),
        supabase.from('grupos_etapa').select('*').eq('etapa', etapaAtual).order('grupo'),
      ]);
      if (errItens || errGrupos) {
        setFeedback(`❌ Erro ao carregar dados: ${(errItens || errGrupos).message}`);
      } else {
        const ordenados = [...(dItens || [])].sort((a, b) =>
          String(a.num_item || '').localeCompare(String(b.num_item || ''), 'pt-BR', { numeric: true })
        );
        setItens(ordenados);
        setGrupos(dGrupos || []);
      }
    } else {
      const { data, error } = await supabase
        .from('cronograma_anual')
        .select('*')
        .order('etapa_num')
        .order('tipo', { ascending: false });
      if (error) {
        setFeedback(`❌ Erro ao carregar cronograma: ${error.message}`);
      } else {
        setCronograma(data || []);
      }
    }
    setLoading(false);
  }

  async function salvarItem(e) {
    e.preventDefault();
    const payload = {
      ...novoItem,
      etapa: etapaAtual,
      qtd_total: Number(novoItem.qtd_total || 0),
      valor_unitario: Number(novoItem.valor_unitario || 0),
      emc_ctc: Number(novoItem.emc_ctc || 0),
    };

    const { error } = editandoId
      ? await supabase.from('planejamento_itens').update(payload).eq('id', editandoId)
      : await supabase.from('planejamento_itens').insert([payload]);

    if (error) {
      alert('Erro ao salvar item: ' + error.message);
      return;
    }

    setFeedback(editandoId ? '✅ Item atualizado com sucesso!' : `✅ Item adicionado na Etapa ${etapaAtual}!`);
    setEditandoId(null);
    setNovoItem(CAMPOS_INICIAIS);
    carregarDados();
  }

  function iniciarEdicao(item) {
    setEditandoId(item.id);
    setNovoItem({
      num_item: item.num_item ?? '',
      qtd_total: item.qtd_total ?? '',
      processo: item.processo ?? '',
      responsavel_pesquisa: item.responsavel_pesquisa ?? '',
      item_comp: item.item_comp ?? 'Não',
      item_excl: item.item_excl ?? '',
      dem_excl: item.dem_excl ?? '',
      pecul: item.pecul ?? '',
      cod_siasg: item.cod_siasg ?? '',
      codigo_item: item.codigo_item ?? '',
      unidade_medida: item.unidade_medida ?? 'UN',
      descricao_resumida: item.descricao_resumida ?? '',
      especificacao: item.especificacao ?? '',
      detalhamento: item.detalhamento ?? '',
      valor_unitario: item.valor_unitario ?? '',
      emc_ctc: item.emc_ctc ?? '',
      sd: item.sd ?? '',
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNovoItem(CAMPOS_INICIAIS);
  }

  async function excluirItem(id) {
    if (!confirm('Remover este item do planejamento?')) return;
    const { error } = await supabase.from('planejamento_itens').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir item: ' + error.message);
      return;
    }
    if (editandoId === id) cancelarEdicao();
    carregarDados();
  }

  async function atualizarDataCronograma(id, campo, valor) {
    const { error } = await supabase
      .from('cronograma_anual')
      .update({ [campo]: valor || null })
      .eq('id', id);
    if (error) {
      setFeedback(`❌ Erro ao atualizar data: ${error.message}`);
      return;
    }
    carregarDados();
  }

  function importarCSV(e) {
    const file = e.target.files?.[0];
    if (!file || !etapaAtual) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const registros = results.data
          .filter((r) => r['Descrição Resumida'] || r['descricao_resumida'])
          .map((r) => ({
            etapa: etapaAtual,
            num_item: r['Nº Item'] || r['num_item'] || '',
            qtd_total: parseNumeroBR(r['Qtd. Total'] || r['qtd_total']),
            processo: r['Processo'] || r['processo'] || '',
            responsavel_pesquisa: r['Responsável pela Pesquisa'] || r['responsavel_pesquisa'] || '',
            item_comp: r['Item comp.'] || r['item_comp'] || 'Não',
            item_excl: r['Item excl.'] || r['item_excl'] || '',
            dem_excl: r['Dem. excl.'] || r['dem_excl'] || '',
            pecul: r['Pecul.'] || r['pecul'] || '',
            cod_siasg: r['Cód. SIASG'] || r['cod_siasg'] || '',
            codigo_item: r['Código do item'] || r['codigo_item'] || '',
            unidade_medida: r['Unidade de Medida'] || r['unidade_medida'] || 'UN',
            descricao_resumida: r['Descrição Resumida'] || r['descricao_resumida'] || '',
            especificacao: r['Especificação'] || r['especificacao'] || '',
            detalhamento: r['Detalhamento (especificação complementar)'] || r['detalhamento'] || '',
            valor_unitario: parseNumeroBR(r['Valor unitário'] || r['valor_unitario']),
            emc_ctc: parseNumeroBR(r['EMC/CTC'] || r['emc_ctc']),
            sd: r['SD'] || r['sd'] || '',
          }));

        if (!registros.length) {
          alert('Nenhuma linha válida encontrada no CSV.');
          return;
        }

        const { error } = await supabase.from('planejamento_itens').insert(registros);
        if (error) {
          alert('Erro ao importar CSV: ' + error.message);
        } else {
          setFeedback(`✅ ${registros.length} itens importados para a Etapa ${etapaAtual}!`);
          carregarDados();
        }
        e.target.value = '';
      },
    });
  }

  function exportarCSV() {
    const csv = Papa.unparse(
      itensFiltrados.map((i) => ({
        'Nº Item': i.num_item,
        'Qtd. Total': i.qtd_total,
        Processo: i.processo,
        'Responsável pela Pesquisa': i.responsavel_pesquisa,
        'Item comp.': i.item_comp,
        'Item excl.': i.item_excl,
        'Dem. excl.': i.dem_excl,
        'Pecul.': i.pecul,
        'Cód. SIASG': i.cod_siasg,
        'Código do item': i.codigo_item,
        'Unidade de Medida': i.unidade_medida,
        'Descrição Resumida': i.descricao_resumida,
        Especificação: i.especificacao,
        'Detalhamento (especificação complementar)': i.detalhamento,
        'Valor unitário': i.valor_unitario,
        'Valor total': i.valor_total,
        'EMC/CTC': i.emc_ctc,
        SD: i.sd,
      }))
    );
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planejamento_etapa_${etapaAtual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function acionarAgenda(comando) {
    setFeedback('Acionando integração com Google Agenda...');
    try {
      await dispararAutomacaoGitHub(comando, false);
      setFeedback(`✅ Comando "${comando}" enviado ao GitHub Actions! A agenda será atualizada em instantes.`);
    } catch (err) {
      setFeedback(`❌ ${err.message}`);
    }
  }

  const itensFiltrados = itens.filter((i) =>
    `${i.num_item} ${i.codigo_item} ${i.descricao_resumida} ${i.especificacao} ${i.processo} ${i.detalhamento}`
      .toLowerCase()
      .includes(filtroTexto.toLowerCase())
  );

  const totalEtapa = itensFiltrados.reduce((acc, i) => acc + Number(i.valor_total || 0), 0);

  return (
    <div className="space-y-5">
      {/* Navegação interna das 5 Etapas + Cronograma */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => {
              setAba(`etapa-${num}`);
              setFeedback('');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              aba === `etapa-${num}`
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Planejamento (Etapa {num})
          </button>
        ))}
        <button
          onClick={() => {
            setAba('cronograma');
            setFeedback('');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            aba === 'cronograma'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Cronograma Anual & Agenda
        </button>
      </div>

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-lg text-xs font-medium">
          {feedback}
        </div>
      )}

      {etapaAtual ? (
        <>
          {/* Grupos habilitados na Etapa */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-950">
            <strong className="uppercase tracking-wide">Grupos habilitados na Etapa {etapaAtual}:</strong>{' '}
            {grupos.length
              ? grupos.map((g) => `${g.grupo}${g.descricao ? ` (${g.descricao})` : ''}`).join(' • ')
              : 'Nenhum grupo cadastrado para esta etapa.'}
          </div>

          {/* Formulário completo com todos os 18 campos padronizados */}
          <form
            onSubmit={salvarItem}
            className={`bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-3 text-xs ${
              editandoId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
            }`}
          >
            {editandoId && (
              <div className="col-span-2 md:col-span-6 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg">
                <span className="font-semibold">
                  Editando item {novoItem.num_item || '(sem nº)'} — {novoItem.descricao_resumida}
                </span>
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              </div>
            )}
            <input
              placeholder="Nº Item (ex: 0010)"
              value={novoItem.num_item}
              onChange={(e) => setNovoItem({ ...novoItem, num_item: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Qtd. Total *"
              value={novoItem.qtd_total}
              onChange={(e) => setNovoItem({ ...novoItem, qtd_total: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
              required
            />
            <input
              placeholder="Processo (23080...)"
              value={novoItem.processo}
              onChange={(e) => setNovoItem({ ...novoItem, processo: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Resp. Pesquisa"
              value={novoItem.responsavel_pesquisa}
              onChange={(e) => setNovoItem({ ...novoItem, responsavel_pesquisa: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <select
              value={novoItem.item_comp}
              onChange={(e) => setNovoItem({ ...novoItem, item_comp: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            >
              <option value="Não">Item comp.: Não</option>
              <option value="Sim">Item comp.: Sim</option>
            </select>
            <input
              placeholder="Item excl."
              value={novoItem.item_excl}
              onChange={(e) => setNovoItem({ ...novoItem, item_excl: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Dem. excl."
              value={novoItem.dem_excl}
              onChange={(e) => setNovoItem({ ...novoItem, dem_excl: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Pecul."
              value={novoItem.pecul}
              onChange={(e) => setNovoItem({ ...novoItem, pecul: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Cód. SIASG"
              value={novoItem.cod_siasg}
              onChange={(e) => setNovoItem({ ...novoItem, cod_siasg: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Código do item (077.42...)"
              value={novoItem.codigo_item}
              onChange={(e) => setNovoItem({ ...novoItem, codigo_item: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Unid. Medida (UN)"
              value={novoItem.unidade_medida}
              onChange={(e) => setNovoItem({ ...novoItem, unidade_medida: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Valor Unitário (R$) *"
              value={novoItem.valor_unitario}
              onChange={(e) => setNovoItem({ ...novoItem, valor_unitario: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
              required
            />
            <input
              placeholder="Descrição Resumida *"
              value={novoItem.descricao_resumida}
              onChange={(e) => setNovoItem({ ...novoItem, descricao_resumida: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg col-span-2"
              required
            />
            <input
              placeholder="Especificação"
              value={novoItem.especificacao}
              onChange={(e) => setNovoItem({ ...novoItem, especificacao: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg col-span-2"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Qtd. EMC/CTC"
              value={novoItem.emc_ctc}
              onChange={(e) => setNovoItem({ ...novoItem, emc_ctc: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Nº SD"
              value={novoItem.sd}
              onChange={(e) => setNovoItem({ ...novoItem, sd: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <textarea
              placeholder="Detalhamento (especificação complementar)"
              value={novoItem.detalhamento}
              onChange={(e) => setNovoItem({ ...novoItem, detalhamento: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg col-span-2 md:col-span-5"
              rows={2}
            />
            <button
              type="submit"
              className={`${
                editandoId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'
              } text-white font-semibold rounded-lg p-2 flex items-center justify-center gap-1.5 transition`}
            >
              {editandoId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editandoId ? 'Salvar Alterações' : `Adicionar Etapa ${etapaAtual}`}
            </button>
          </form>

          {/* Barra de busca, importação/exportação CSV e totalizador */}
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Filtrar por nº item, código, descrição, especificação ou processo..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs w-full bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Importar CSV
                <input type="file" accept=".csv" onChange={importarCSV} className="hidden" />
              </label>
              <button
                onClick={exportarCSV}
                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
              <div className="bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold">
                Total Etapa {etapaAtual} ({itensFiltrados.length} itens): {formatBRL(totalEtapa)}
              </div>
            </div>
          </div>

          {/* Tabela completa da Etapa (todas as 18 colunas + Ação) */}
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full text-xs divide-y divide-slate-200">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2.5 text-left">Nº Item</th>
                  <th className="p-2.5 text-right">Qtd. Total</th>
                  <th className="p-2.5 text-left">Processo</th>
                  <th className="p-2.5 text-left">Resp. Pesq.</th>
                  <th className="p-2.5">Comp.</th>
                  <th className="p-2.5">Excl.</th>
                  <th className="p-2.5">Dem. Excl.</th>
                  <th className="p-2.5">Pecul.</th>
                  <th className="p-2.5">SIASG</th>
                  <th className="p-2.5 text-left">Cód. Item</th>
                  <th className="p-2.5">Unid.</th>
                  <th className="p-2.5 text-left">Descrição Resumida</th>
                  <th className="p-2.5 text-left">Especificação</th>
                  <th className="p-2.5 text-left">Detalhamento</th>
                  <th className="p-2.5 text-right">Vlr. Unit.</th>
                  <th className="p-2.5 text-right">Vlr. Total</th>
                  <th className="p-2.5 text-right">EMC/CTC</th>
                  <th className="p-2.5">SD</th>
                  <th className="p-2.5">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={19} className="p-6 text-center text-slate-500">Carregando itens...</td>
                  </tr>
                ) : itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="p-6 text-center text-slate-500">
                      Nenhum item cadastrado nesta etapa. Use o formulário acima ou importe o CSV da aba original.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((i) => (
                    <tr key={i.id} className={`hover:bg-slate-50 ${editandoId === i.id ? 'bg-amber-50/70' : ''}`}>
                      <td className="p-2 font-mono">{i.num_item}</td>
                      <td className="p-2 text-right">{i.qtd_total}</td>
                      <td className="p-2 whitespace-nowrap">{i.processo}</td>
                      <td className="p-2">{i.responsavel_pesquisa}</td>
                      <td className="p-2 text-center">{i.item_comp}</td>
                      <td className="p-2 text-center">{i.item_excl}</td>
                      <td className="p-2 text-center">{i.dem_excl}</td>
                      <td className="p-2 text-center">{i.pecul}</td>
                      <td className="p-2 text-center">{i.cod_siasg}</td>
                      <td className="p-2 font-mono whitespace-nowrap">{i.codigo_item}</td>
                      <td className="p-2 text-center">{i.unidade_medida}</td>
                      <td className="p-2 font-medium">{i.descricao_resumida}</td>
                      <td className="p-2 max-w-xs truncate" title={i.especificacao}>{i.especificacao || '-'}</td>
                      <td className="p-2 max-w-xs truncate" title={i.detalhamento}>{i.detalhamento || '-'}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatBRL(i.valor_unitario)}</td>
                      <td className="p-2 text-right font-semibold whitespace-nowrap">{formatBRL(i.valor_total)}</td>
                      <td className="p-2 text-right">{i.emc_ctc}</td>
                      <td className="p-2">{i.sd}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => iniciarEdicao(i)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Editar item"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => excluirItem(i.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Excluir item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Sub-aba Cronograma Anual + Botões Google Agenda */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => acionarAgenda('agenda-sync')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              Sincronizar Cronograma no Google Agenda
            </button>
            <button
              onClick={() => acionarAgenda('agenda-limpar-cronograma')}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Apagar Eventos "CRONOGRAMA"
            </button>
            <button
              onClick={() => acionarAgenda('agenda-limpar-ano')}
              className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Apagar Todos Eventos do Ano Atual
            </button>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full text-xs divide-y divide-slate-200">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2.5 text-left">Etapa</th>
                  <th className="p-2.5 text-left">Atividade</th>
                  <th className="p-2.5">Responsável</th>
                  <th className="p-2.5">Dias Úteis</th>
                  <th className="p-2.5">Início (Editável)</th>
                  <th className="p-2.5">Fim (Editável)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cronograma.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold">{c.etapa_nome}</td>
                    <td className="p-2.5">{c.atividade}</td>
                    <td className="p-2.5 text-center">{c.responsavel}</td>
                    <td className="p-2.5 text-center">{c.dias_uteis}</td>
                    <td className="p-2.5 text-center">
                      <input
                        type="date"
                        value={c.data_inicio || ''}
                        onChange={(e) => atualizarDataCronograma(c.id, 'data_inicio', e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="date"
                        value={c.data_fim || ''}
                        onChange={(e) => atualizarDataCronograma(c.id, 'data_fim', e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
