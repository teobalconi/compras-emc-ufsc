import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import PlanejamentoModule from './components/PlanejamentoModule';
import ExecucaoModule from './components/ExecucaoModule';
import ConfigAutomacoes from './components/ConfigAutomacoes';
import { ClipboardList, PackageCheck, Settings, LogOut, ShieldCheck } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [modulo, setModulo] = useState('planejamento'); // 'planejamento' | 'execucao' | 'config'
  const [msgLogin, setMsgLogin] = useState('');
  const [erroLogin, setErroLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loginMagicLink(e) {
    e.preventDefault();
    setErroLogin(false);
    setMsgLogin('Enviando link de acesso...');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      setErroLogin(true);
      setMsgLogin(`Erro ao enviar link: ${error.message}`);
    } else {
      setMsgLogin('Link de acesso enviado! Verifique sua caixa de entrada (inclusive spam).');
    }
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 text-sm">
        Carregando sistema Compras EMC...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <form onSubmit={loginMagicLink} className="bg-white p-7 rounded-2xl shadow-lg border border-slate-200 w-full max-w-md space-y-4">
          <div className="flex items-center gap-2 text-blue-700">
            <ShieldCheck className="w-6 h-6" />
            <h1 className="text-lg font-bold text-slate-900">Compras EMC - UFSC</h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sistema integrado de <strong>Planejamento</strong> e <strong>Execução</strong> (2025-26).
            O acesso é restrito aos e-mails institucionais cadastrados na aba <strong>Equipe</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">E-mail institucional</label>
            <input
              type="email"
              placeholder="seu.nome@ufsc.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-semibold text-sm transition"
          >
            Receber Link de Acesso por E-mail
          </button>
          {msgLogin && (
            <p className={`text-xs p-2.5 rounded-lg ${erroLogin ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-800'}`}>
              {msgLogin}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-6 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="font-bold text-base tracking-tight">[Compras EMC] Planejamento & Execução (2025-26)</h1>
            <p className="text-xs text-slate-400">Usuário autenticado: {session.user.email}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setModulo('planejamento')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition ${
                modulo === 'planejamento' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Planejamento (5 Etapas)
            </button>
            <button
              onClick={() => setModulo('execucao')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition ${
                modulo === 'execucao' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              Execução & Saldos
            </button>
            <button
              onClick={() => setModulo('config')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition ${
                modulo === 'config' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Equipe, Grupos & E-mails
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-medium transition"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-6 flex-1">
        {modulo === 'planejamento' && <PlanejamentoModule />}
        {modulo === 'execucao' && <ExecucaoModule />}
        {modulo === 'config' && <ConfigAutomacoes />}
      </main>
    </div>
  );
}
