import { useEffect, useState } from 'react';
import { supabase, dispararAutomacaoGitHub } from '../lib/supabase';
import { Mail, Plus, Trash2 } from 'lucide-react';

export default function ConfigAutomacoes() {
  const [equipe, setEquipe] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [novoMembro, setNovoMembro] = useState({ nome: '', email: '', etapas: '', responsavel: '' });
  const [novoGrupo, setNovoGrupo] = useState({ etapa: 1, grupo: '', descricao: '' });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const [{ data: eq }, { data: gr }] = await Promise.all([
      supabase.from('equipe').select('*').order('nome'),
      supabase.from('grupos_etapa').select('*').order('etapa').order('grupo'),
    ]);
    setEquipe(eq || []);
    setGrupos(gr || []);
  }

  async function executar(comando, teste = false) {
    setStatusMsg('Disparando automação no GitHub Actions...');
    try {
      await dispararAutomacaoGitHub(comando, teste);
      setStatusMsg(`✅ Comando "${comando}" (modo teste: ${teste ? 'Sim' : 'Não'}) enviado com sucesso!`);
    } catch (err) {
      setStatusMsg(`❌ ${err.message}`);
    }
  }

  async function adicionarMembro(e) {
    e.preventDefault();
    const { error } = await supabase.from('equipe').insert([novoMembro]);
    if (error) return alert(error.message);
    setNovoMembro({ nome: '', email: '', etapas: '', responsavel: '' });
    carregar();
  }

  async function alternarAtivo(membro) {
    await supabase.from('equipe').update({ ativo: !membro.ativo }).eq('id', membro.id);
    carregar();
  }

  async function adicionarGrupo(e) {
    e.preventDefault();
    const { error } = await supabase
      .from('grupos_etapa')
      .insert([{ ...novoGrupo, etapa: Number(novoGrupo.etapa) }]);
    if (error) return alert(error.message);
    setNovoGrupo({ etapa: 1, grupo: '', descricao: '' });
    carregar();
  }

  return (
    <div className="space-y-6">
      {/* Painel de Disparos Manuais e Testes */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900">
          <Mail className="w-4 h-4 text-blue-700" />
          <h3 className="font-bold text-sm">Central de E-mails Automáticos e Testes (Gatilhos Migrados)</h3>
        </div>
        <p className="text-xs text-slate-600">
          Os envios ocorrem automaticamente via <strong>GitHub Actions</strong> (todos os dias às 7h e 8h, e dia 1º de cada mês).
          Use os botões abaixo para disparo imediato ou teste (envia apenas ao 1º e-mail ativo da Equipe):
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => executar('alerta-inicio', false)} className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg font-medium">
            Disparar Alerta Início Hoje
          </button>
          <button onClick={() => executar('alerta-inicio', true)} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-3 py-2 rounded-lg font-medium">
            Testar Alerta Início
          </button>
          <button onClick={() => executar('alerta-fim', false)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg font-medium">
            Disparar Alerta Fim (7d)
          </button>
          <button onClick={() => executar('alerta-fim', true)} className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-2 rounded-lg font-medium">
            Testar Alerta Fim
          </button>
          <button onClick={() => executar('resumo-cronograma', false)} className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg font-medium">
            Resumo Mensal Cronograma
          </button>
          <button onClick={() => executar('resumo-pregoes', false)} className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg font-medium">
            Resumo Mensal Pregões
          </button>
          <button onClick={() => executar('resumo-pregoes', true)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-3 py-2 rounded-lg font-medium">
            Testar Resumo Pregões
          </button>
          <button onClick={() => executar('alerta-30dias', false)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded-lg font-medium">
            Alerta Pregões 30 Dias
          </button>
          <button onClick={() => executar('alerta-30dias', true)} className="bg-red-100 hover:bg-red-200 text-red-900 px-3 py-2 rounded-lg font-medium">
            Testar Alerta 30 Dias
          </button>
        </div>
        {statusMsg && <p className="text-xs font-medium text-blue-800 bg-blue-50 p-2.5 rounded-lg">{statusMsg}</p>}
      </div>

      {/* Tabela Equipe */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Equipe e Destinatários de E-mail</h3>

        <form onSubmit={adicionarMembro} className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
          <input placeholder="Nome *" value={novoMembro.nome} onChange={(e) => setNovoMembro({ ...novoMembro, nome: e.target.value })} className="border p-2 rounded-lg" required />
          <input type="email" placeholder="E-mail *" value={novoMembro.email} onChange={(e) => setNovoMembro({ ...novoMembro, email: e.target.value })} className="border p-2 rounded-lg" required />
          <input placeholder="Etapas" value={novoMembro.etapas} onChange={(e) => setNovoMembro({ ...novoMembro, etapas: e.target.value })} className="border p-2 rounded-lg" />
          <input placeholder="Responsável" value={novoMembro.responsavel} onChange={(e) => setNovoMembro({ ...novoMembro, responsavel: e.target.value })} className="border p-2 rounded-lg" />
          <button type="submit" className="bg-blue-700 text-white rounded-lg p-2 font-semibold flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </form>

        <table className="min-w-full text-xs divide-y divide-slate-200">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">E-mail</th>
              <th className="p-2 text-left">Etapas</th>
              <th className="p-2 text-left">Responsável</th>
              <th className="p-2">Recebe E-mails / Acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipe.map((m) => (
              <tr key={m.id}>
                <td className="p-2 font-medium">{m.nome}</td>
                <td className="p-2">{m.email}</td>
                <td className="p-2">{m.etapas || '-'}</td>
                <td className="p-2">{m.responsavel || '-'}</td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => alternarAtivo(m)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      m.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela Grupos */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Grupos SIASG por Etapa (Etapas 1 a 5)</h3>

        <form onSubmit={adicionarGrupo} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <select value={novoGrupo.etapa} onChange={(e) => setNovoGrupo({ ...novoGrupo, etapa: e.target.value })} className="border p-2 rounded-lg">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Etapa {n}</option>
            ))}
          </select>
          <input placeholder="Código Grupo (ex: 077.42) *" value={novoGrupo.grupo} onChange={(e) => setNovoGrupo({ ...novoGrupo, grupo: e.target.value })} className="border p-2 rounded-lg" required />
          <input placeholder="Descrição do Grupo" value={novoGrupo.descricao} onChange={(e) => setNovoGrupo({ ...novoGrupo, descricao: e.target.value })} className="border p-2 rounded-lg" />
          <button type="submit" className="bg-blue-700 text-white rounded-lg p-2 font-semibold flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> Adicionar Grupo
          </button>
        </form>

        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full text-xs divide-y divide-slate-200">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="p-2">Etapa</th>
                <th className="p-2 text-left">Grupo</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td className="p-2 text-center font-semibold">Etapa {g.etapa}</td>
                  <td className="p-2 font-mono">{g.grupo}</td>
                  <td className="p-2">{g.descricao || '-'}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={async () => {
                        await supabase.from('grupos_etapa').delete().eq('id', g.id);
                        carregar();
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
