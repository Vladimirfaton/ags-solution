import { Banknote, BookOpen, KeyRound, LayoutDashboard, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';
import { PLATFORM_NAME } from '../config/branding';

const workspaceMeta = {
  secretaire: { title: 'Secrétariat', subtitle: 'Classes, élèves et dossiers scolaires', icon: <BookOpen className="h-5 w-5" />, menu: [{ id: 'tableau', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> }, { id: 'classes', label: 'Classes et élèves', icon: <Users className="h-4 w-4" /> }] },
  comptable: { title: 'Comptabilité', subtitle: 'Inscriptions, frais et encaissements', icon: <Banknote className="h-5 w-5" />, menu: [{ id: 'tableau', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> }, { id: 'inscriptions', label: 'Inscriptions', icon: <Users className="h-4 w-4" /> }, { id: 'finances', label: 'Frais et tarifs', icon: <Banknote className="h-4 w-4" /> }, { id: 'caisse', label: 'Caisse', icon: <Banknote className="h-4 w-4" /> }] },
  censeur: { title: 'Censeur', subtitle: 'Suivi des élèves et des classes', icon: <ShieldCheck className="h-5 w-5" />, menu: [{ id: 'tableau', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> }, { id: 'classes', label: 'Classes et élèves', icon: <Users className="h-4 w-4" /> }] },
};

export default function ManagementWorkspace({ role, user, establishmentName, section, setSection, onLogout, content }) {
  const meta = workspaceMeta[role];
  const menu = meta?.menu || [];
  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-900 md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white">{meta?.icon}</span><div><p className="text-sm font-bold text-slate-800">{PLATFORM_NAME}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">AGS Solution</p></div></div></div>
        <div className="px-4 py-6"><p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{meta?.title}</p><nav className="space-y-1">{menu.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${section === item.id ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>{item.icon}{item.label}</button>)}</nav></div>
        <div className="mt-auto border-t border-slate-100 p-4"><button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"><LogOut className="h-4 w-4" />Déconnexion</button></div>
      </aside>
      <main className="min-w-0 flex-1"><header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><h1 className="text-lg font-semibold text-slate-900">Espace {meta?.title}</h1><div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500"><span className="max-w-[min(55vw,420px)] truncate rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700" title={establishmentName || 'Établissement'}>{establishmentName || 'Établissement'}</span><span className="text-slate-300">•</span><span className="truncate">{meta?.subtitle}</span></div></div><div className="hidden max-w-48 truncate text-right sm:block"><p className="truncate text-sm font-semibold text-slate-800">{user?.prenom} {user?.nom}</p><p className="text-xs text-slate-500">{meta?.title}</p></div></div></header><div className="mx-auto max-w-[1400px] p-5 sm:p-8">{content}</div></main>
    </div>
  );
}
