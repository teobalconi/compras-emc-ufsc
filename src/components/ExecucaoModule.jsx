import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import {
  parseNumeroBR,
  formatBRL,
  parseDataBRtoISO,
  formatDateBR,
  diffDaysFromToday,
} from '../lib/utils';
import { Upload, Plus, Search, Pencil, Trash2, X } from 'lucide-react';

const SALDO_INICIAL = {
  setor: 'EMC/CTC',
  edital_oficio: '',
  item: '',
  codigo: '',
  unidade: 'UN',
  descricao: '',
  licitado: '',
  saldo_total: '',
  qt_def_setor: '',
  saldo_setor: '',
  valor_unitario: '',
  fim_vigencia: '',
  detalhamento: '',
};

const PEDIDO_INICIAL = {
  saldo_item_id: '',
  solicitante: '',
  laboratorio_setor: '',
  quantidade: 1,
  numero_sd_empenho: '',
  status: 'Solicitado',
  observacao: '',
};

export default function ExecucaoModule() {
  const [aba, setAba] = useState('saldo'); // 'saldo' | 'execucao' | 'atas'
  const [saldos, setSaldos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [atas, setAtas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtroPedidos, setFiltroPedidos] = useState('');
  const [feedback, setFeedback] = useState('');

  const [mostrarFormSaldo, setMostrarFormSaldo] = useState(false);
  const [novoSaldo, setNovoSaldo] = useState(SALDO_INICIAL);
  const [editandoSaldoId, setEditandoSaldoId] = useState(null);

  const [novoPedido, setNovoPedido] = useState(PEDIDO_INICIAL);
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);

  useEffect(() => {
    carregar();
  }, [aba]);

  async function carregar() {
    const [{ data: dSaldos, error: errS }, { data: dPedidos, error: errP }, { data: dAtas, error: errA }] =
      await Promise.all([
        supabase.from('saldo_anual').select('*').order('fim_vigencia'),
        supabase
          .from('execucao_pedidos')
          .select('*, saldo_anual(edital_oficio, item, descricao, unidade)')
          .order('data_pedido', { ascending: false }),
        supabase.from('atas_vigentes').select('*'),
      ]);

    const erro = errS || errP || errA;
    if (erro) {
      setFeedback(`❌ Erro ao carregar dados: ${erro.message}`);
      return;
    }

    setSaldos(dSaldos || []);
    setPedidos(dPedidos || []);
    setAtas(dAtas || []);
  }

  async function salvarSaldo(e) {
    e.preventDefault();
    const qtDefSetor = Number(novoSaldo.qt_def_setor || 0);
    const saldoSetor =
      novoSaldo.saldo_setor === '' ? qtDefSetor : Number(novoSaldo.saldo_setor || 0);

    const payload = {
      setor: novoSaldo.setor.trim() || 'EMC/CTC',
      edital_oficio: novoSaldo.edital_oficio.trim(),
      item: novoSaldo.item.trim(),
      codigo: novoSaldo.codigo.trim(),
      unidade: novoSaldo.unidade.trim() || 'UN',
      descricao: novoSaldo.descricao.trim(),
      licitado: Number(novoSaldo.licitado || 0),
      saldo_total: Number(novoSaldo.saldo_total || 0),
      qt_def_setor: qtDefSetor,
      saldo_setor: saldoSetor,
      valor_unitario: Number(novoSaldo.valor_unitario || 0),
      fim_vigencia: novoSaldo.fim_vigencia,
      detalhamento: novoSaldo.detalhamento.trim(),
    };

    const { error } = editandoSaldoId
      ? await supabase.from('saldo_anual').update(payload).eq('id', editandoSaldoId)
      : await supabase.from('saldo_anual').insert([payload]);

    if (error) {
      alert('Erro ao salvar item no Saldo Anual: ' + error.message);
      return;
    }

    setFeedback(
      editandoSaldoId ? '✅ Item do Saldo Anual atualizado!' : '✅ Item adicionado ao Saldo Anual!'
    );
    cancelarEdicaoSaldo();
    carregar();
  }

  function iniciarEdicaoSaldo(s) {
    setEditandoSaldoId(s.id);
    setMostrarFormSaldo(true);
    setNovoSaldo({
      setor: s.setor ?? 'EMC/CTC',
      edital_oficio: s.edital_oficio ?? '',
      item: s.item ?? '',
      codigo: s.codigo ?? '',
      unidade: s.unidade ?? 'UN',
      descricao: s.descricao ?? '',
      licitado: s.licitado ?? '',
      saldo_total: s.saldo_total ?? '',
      qt_def_setor: s.qt_def_setor ?? '',
      saldo_setor: s.saldo_setor ?? '',
      valor_unitario: s.valor_unitario ?? '',
      fim_vigencia: s.fim_vigencia ?? '',
      detalhamento: s.detalhamento ?? '',
    });
  }

  function cancelarEdicaoSaldo() {
    setEditandoSaldoId(null);
    setMostrarFormSaldo(false);
    setNovoSaldo(SALDO_INICIAL);
  }

  async function excluirSaldo(id) {
    if (!confirm('Remover este item do Saldo Anual?')) return;
    const { error } = await supabase.from('saldo_anual').delete().eq('id', id);
    if (error) {
      alert(
        'Não foi possível remover o item (verifique se existem pedidos vinculados na aba Execução): ' +
          error.message
      );
      return;
    }
    if (editandoSaldoId === id) cancelarEdicaoSaldo();
    setFeedback('✅ Item removido do Saldo Anual.');
    carregar();
  }

  async function registrarPedido(e) {
    e.preventDefault();
    const qtd = Number(novoPedido.quantidade);
    const itemSelecionado = saldos.find((s) => s.id === novoPedido.saldo_item_id);

    if (itemSelecionado && novoPedido.status !== 'Cancelado') {
      const pedidoAnterior = editandoPedidoId
        ? pedidos.find((p) => p.id === editandoPedidoId)
        : null;
      const creditoAnterior =
        pedidoAnterior &&
        pedidoAnterior.saldo_item_id === novoPedido.saldo_item_id &&
        pedidoAnterior.status !== 'Cancelado'
          ? Number(pedidoAnterior.quantidade)
          : 0;
      const saldoDisponivel = Number(itemSelecionado.saldo_setor) + creditoAnterior;
      if (qtd > saldoDisponivel) {
        const prosseguir = confirm(
          `A quantidade (${qtd}) excede o saldo disponível (${saldoDisponivel}). Deseja registrar mesmo assim?`
        );
        if (!prosseguir) return;
      }
    }

    const payload = {
      saldo_item_id: novoPedido.saldo_item_id,
      solicitante: novoPedido.solicitante.trim(),
      laboratorio_setor: novoPedido.laboratorio_setor.trim(),
      quantidade: qtd,
      numero_sd_empenho: novoPedido.numero_sd_empenho.trim(),
      status: novoPedido.status,
      observacao: novoPedido.observacao.trim(),
    };

    const { error } = editandoPedidoId
      ? await supabase.from('execucao_pedidos').update(payload).eq('id', editandoPedidoId)
      : await supabase.from('execucao_pedidos').insert([payload]);

    if (error) {
      alert('Erro ao salvar pedido: ' + error.message);
      return;
    }

    setFeedback(
      editandoPedidoId
        ? '✅ Pedido atualizado e saldo recalculado!'
        : '✅ Pedido registrado e saldo abatido!'
    );
    cancelarEdicaoPedido();
    carregar();
  }

  function iniciarEdicaoPedido(p) {
    setEditandoPedidoId(p.id);
    setNovoPedido({
      saldo_item_id: p.saldo_item_id ?? '',
      solicitante: p.solicitante ?? '',
      laboratorio_setor: p.laboratorio_setor ?? '',
      quantidade: p.quantidade ?? 1,
      numero_sd_empenho: p.numero_sd_empenho ?? '',
      status: p.status ?? 'Solicitado',
      observacao: p.observacao ?? '',
    });
  }

  function cancelarEdicaoPedido() {
    setEditandoPedidoId(null);
    setNovoPedido(PEDIDO_INICIAL);
  }

  async function atualizarStatusPedido(id, novoStatus) {
    const { error } = await supabase.from('execucao_pedidos').update({ status: novoStatus }).eq('id', id);
    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
      return;
    }
    carregar();
  }

  async function excluirPedido(id) {
    if (!confirm('Excluir este pedido? Se estiver ativo, o saldo será estornado automaticamente.')) return;
    const { error } = await supabase.from('execucao_pedidos').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir pedido: ' + error.message);
      return;
    }
    if (editandoPedidoId === id) cancelarEdicaoPedido();
    setFeedback('✅ Pedido removido e saldo atualizado.');
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
          setFeedback(`✅ ${registros.length} itens importados para Saldo Anual!`);
          carregar();
        }
        e.target.value = '';
      },
    });
  }

  const saldosFiltrados = saldos.filter((s) =>
    `${s.edital_oficio} ${s.codigo} ${s.descricao} ${s.setor} ${s.item}`
      .toLowerCase()
      .includes(filtro.toLowerCase())
  );

  const pedidosFiltrados = pedidos.filter((p) =>
    `${p.saldo_anual?.edital_oficio || ''} ${p.saldo_anual?.descricao || ''} ${p.solicitante} ${p.laboratorio_setor || ''} ${p.numero_sd_empenho || ''} ${p.observacao || ''}`
      .toLowerCase()
      .includes(filtroPedidos.toLowerCase())
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
            onClick={() => {
              setAba(t.id);
              setFeedback('');
            }}
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

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-lg text-xs font-medium">
          {feedback}
        </div>
      )}

      {aba === 'saldo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Filtrar por pregão/edital, item, código ou descrição..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs w-full bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (mostrarFormSaldo) cancelarEdicaoSaldo();
                  else setMostrarFormSaldo(true);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {mostrarFormSaldo ? 'Fechar Formulário' : 'Novo Item Saldo'}
              </button>
              <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Importar CSV Saldo Anual
                <input type="file" accept=".csv" onChange={importarSaldoCSV} className="hidden" />
              </label>
            </div>
          </div>

          {mostrarFormSaldo && (
            <form
              onSubmit={salvarSaldo}
              className={`bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-3 text-xs ${
                editandoSaldoId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
              }`}
            >
              {editandoSaldoId && (
                <div className="col-span-2 md:col-span-6 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">
                    Editando Saldo: {novoSaldo.edital_oficio} — Item {novoSaldo.item}
                  </span>
                  <button
                    type="button"
                    onClick={cancelarEdicaoSaldo}
                    className="flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                </div>
              )}
              <input
                placeholder="Setor *"
                value={novoSaldo.setor}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, setor: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
                required
              />
              <input
                placeholder="Nº Edital/Ofício *"
                value={novoSaldo.edital_oficio}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, edital_oficio: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
                required
              />
              <input
                placeholder="Item *"
                value={novoSaldo.item}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, item: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
                required
              />
              <input
                placeholder="Código"
                value={novoSaldo.codigo}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, codigo: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                placeholder="Unidade (UN)"
                value={novoSaldo.unidade}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, unidade: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                type="date"
                title="Fim da Vigência *"
                value={novoSaldo.fim_vigencia}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, fim_vigencia: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
                required
              />
              <input
                placeholder="Descrição *"
                value={novoSaldo.descricao}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, descricao: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg col-span-2 md:col-span-3"
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Licitado"
                value={novoSaldo.licitado}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, licitado: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Saldo Total"
                value={novoSaldo.saldo_total}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, saldo_total: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Qt. Def. Setor"
                value={novoSaldo.qt_def_setor}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, qt_def_setor: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Saldo Setor (auto)"
                value={novoSaldo.saldo_setor}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, saldo_setor: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Valor Unit. (R$)"
                value={novoSaldo.valor_unitario}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, valor_unitario: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg"
              />
              <input
                placeholder="Detalhamento do item"
                value={novoSaldo.detalhamento}
                onChange={(e) => setNovoSaldo({ ...novoSaldo, detalhamento: e.target.value })}
                className="border border-slate-300 p-2 rounded-lg col-span-2 md:col-span-3"
              />
              <button
                type="submit"
                className={`${
                  editandoSaldoId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'
                } text-white font-semibold rounded-lg p-2 flex items-center justify-center gap-1`}
              >
                {editandoSaldoId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                {editandoSaldoId ? 'Salvar Item' : 'Adicionar Item'}
              </button>
            </form>
          )}

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
                  <th className="p-2.5">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {saldosFiltrados.map((s) => {
                  const dias = diffDaysFromToday(s.fim_vigencia);
                  const corVigencia =
                    dias <= 15
                      ? 'bg-red-100 text-red-800'
                      : dias <= 30
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-50 text-emerald-800';
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 ${editandoSaldoId === s.id ? 'bg-amber-50/70' : ''}`}>
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
                      <td className="p-2 text-right whitespace-nowrap">{formatBRL(s.valor_unitario)}</td>
                      <td className={`p-2 text-center font-semibold whitespace-nowrap ${corVigencia}`}>
                        {formatDateBR(s.fim_vigencia)} ({dias}d)
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => iniciarEdicaoSaldo(s)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Editar item"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => excluirSaldo(s.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Excluir item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
            className={`bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 text-xs ${
              editandoPedidoId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
            }`}
          >
            {editandoPedidoId && (
              <div className="md:col-span-6 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg">
                <span className="font-semibold">Editando pedido de {novoPedido.solicitante}</span>
                <button
                  type="button"
                  onClick={cancelarEdicaoPedido}
                  className="flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              </div>
            )}
            <select
              value={novoPedido.saldo_item_id}
              onChange={(e) => setNovoPedido({ ...novoPedido, saldo_item_id: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg md:col-span-2"
              required
            >
              <option value="">Selecione o item do Saldo Anual...</option>
              {saldos
                .filter((s) => Number(s.saldo_setor) > 0 || s.id === novoPedido.saldo_item_id)
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
            <input
              placeholder="Nº SD / Empenho"
              value={novoPedido.numero_sd_empenho}
              onChange={(e) => setNovoPedido({ ...novoPedido, numero_sd_empenho: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            />
            <input
              placeholder="Observação"
              value={novoPedido.observacao}
              onChange={(e) => setNovoPedido({ ...novoPedido, observacao: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg md:col-span-4"
            />
            <select
              value={novoPedido.status}
              onChange={(e) => setNovoPedido({ ...novoPedido, status: e.target.value })}
              className="border border-slate-300 p-2 rounded-lg"
            >
              <option value="Solicitado">Solicitado</option>
              <option value="Empenhado">Empenhado</option>
              <option value="Entregue">Entregue</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <button
              type="submit"
              className={`${
                editandoPedidoId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'
              } text-white font-semibold rounded-lg p-2 flex items-center justify-center gap-1`}
            >
              {editandoPedidoId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
              {editandoPedidoId ? 'Salvar Pedido' : 'Abater Saldo'}
            </button>
          </form>

          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              placeholder="Filtrar pedidos por edital, item, solicitante, lab ou SD/Empenho..."
              value={filtroPedidos}
              onChange={(e) => setFiltroPedidos(e.target.value)}
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs w-full bg-white"
            />
          </div>

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
                  <th className="p-2.5 text-left">Observação</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50 ${editandoPedidoId === p.id ? 'bg-amber-50/70' : ''}`}>
                    <td className="p-2 text-center whitespace-nowrap">{formatDateBR(p.data_pedido)}</td>
                    <td className="p-2">
                      {p.saldo_anual?.edital_oficio} - {p.saldo_anual?.descricao}
                    </td>
                    <td className="p-2">{p.solicitante}</td>
                    <td className="p-2">{p.laboratorio_setor || '-'}</td>
                    <td className="p-2 text-right font-semibold">{p.quantidade}</td>
                    <td className="p-2 text-center">{p.numero_sd_empenho || '-'}</td>
                    <td className="p-2 max-w-xs truncate" title={p.observacao}>{p.observacao || '-'}</td>
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
                    <td className="p-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => iniciarEdicaoPedido(p)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar pedido"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => excluirPedido(p.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Excluir pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  <td className="p-2.5 text-center">{formatDateBR(a.fim_vigencia)}</td>
                  <td className="p-2.5 text-center">{a.dias_restantes} dias</td>
                  <td className="p-2.5 text-center">{a.total_itens}</td>
                  <td className="p-2.5 text-right font-semibold">{formatBRL(a.valor_saldo_disponivel)}</td>
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
