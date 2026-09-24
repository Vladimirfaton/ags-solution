import { Building2, KeyRound, LayoutDashboard, LifeBuoy, LogOut, UserRound } from 'lucide-react';
import { PLATFORM_NAME } from '../config/branding';
import DirectorCockpit from './DirectorCockpit';

export default function DirectorWorkspace({ user, establishmentName, onLogout, section, setSection, cockpitProps, content, error, notice }) {
  const navigation = [
    { id: 'tableau', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'profil', label: 'Mon profil', icon: <UserRound className="h-4 w-4" /> },
    { id: 'securite', label: 'Sécurité', icon: <KeyRound className="h-4 w-4" /> },
    { id: 'assistance', label: 'Assistance', icon: <LifeBuoy className="h-4 w-4" /> },
  ];

  return (
  <div className="h-screen overflow-hidden bg-[#f7faf8] text-slate-900 flex">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white"><Building2 className="h-5 w-5" /></span>
          <p className="text-sm font-bold text-slate-800">{PLATFORM_NAME}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pilotage</p>
        <nav className="space-y-1">
          {navigation.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${section === item.id ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>{item.icon}{item.label}</button>)}
        </nav>
      </div>
      <div className="border-t border-slate-100 p-4 shrink-0"><button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"><LogOut className="h-4 w-4" />Déconnexion</button></div>
    </aside>

    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0"><h1 className="text-lg font-semibold text-slate-900">Espace de Direction</h1><div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500"><span className="max-w-[min(55vw,420px)] truncate rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700" title={establishmentName || 'Établissement'}>{establishmentName || 'Établissement'}</span><span className="text-slate-300">•</span><span>Directeur</span></div></div>
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-800">{user?.prenom} {user?.nom}</p><p className="text-xs text-slate-500">Directeur</p></div>
          </div>
        </header>

        <nav className="border-b border-slate-200 bg-white px-3 md:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`shrink-0 border-b-2 px-3 py-3 text-xs font-medium transition ${
                  section === item.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
          {!user?.passwordPersonalized && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Mot de passe initial encore actif : personnalisez-le dans « Sécurité ».
            </div>
          )}

                    {(error || notice) && (
            <div className="fixed inset-x-0 top-24 z-50 flex justify-center px-4 pointer-events-none">
              <div className={`pointer-events-auto max-w-md rounded-xl border px-5 py-4 text-sm font-medium shadow-lg ${
                error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                {error || notice}
              </div>
            </div>
          )}

          {section === 'tableau' ? <DirectorCockpit {...cockpitProps} /> : content}
        </div>
      </div>
    </main>
  </div>
);
}
