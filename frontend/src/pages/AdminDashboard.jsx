import { useEffect, useState } from 'react';
import { Building2, History, IdCard, Image as ImageIcon, LayoutDashboard, LogOut, MapPin, Plus, School, Users } from 'lucide-react';
import { cartesAPI, platformAPI } from '../services/api';
import { PLATFORM_NAME } from '../config/branding';
import { UnreadBell, UnreadLostDeclarationsBell } from '../components/CardAdminShared';
import CardAdminPanel from './CardAdminPanel';

const blankSite = { nom: '', commune: '' };

const BASE_MENU = [
  { id: 'tableau', label: 'Établissement', icon: LayoutDashboard },
  { id: 'service', label: 'Service Cartes', icon: IdCard },
];

const CARD_MENU = [
  { id: 'cartes-classes', label: 'Classes et élèves', icon: School },
  { id: 'cartes-identite', label: 'Identité des cartes', icon: ImageIcon },
  { id: 'cartes-notifications', label: 'Notifications', icon: History },
];

export default function AdminDashboard({ onLogout }) {
  const [ready, setReady] = useState(null);
  const [overview, setOverview] = useState(null);
  const [cardService, setCardService] = useState(null);
  const [section, setSection] = useState('tableau');
  const [nom, setNom] = useState('');
  const [type, setType] = useState('college');
  const [sites, setSites] = useState([{ ...blankSite }]);
  const [newSite, setNewSite] = useState({ ...blankSite });
  const [credentials, setCredentials] = useState(null);
  const [siteCredentials, setSiteCredentials] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data }, cards] = await Promise.all([platformAPI.overview(), cartesAPI.status()]);
    setOverview(data);
    setCardService(cards.data);
  };

  useEffect(() => {
    platformAPI.setupStatus()
      .then(async ({ data }) => { setReady(data.etablissement_cree); if (data.etablissement_cree) await load(); })
      .catch(() => setError('Impossible de charger l’espace FVS.'));
  }, []);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  const initialize = async (event) => {
    event.preventDefault();
    try {
      const { data } = await platformAPI.initialize({ nom, type, sites });
      setCredentials(data.identifiantsInitiaux);
      setReady(true);
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Installation impossible.'); }
  };

  const createSite = async (event) => {
    event.preventDefault();
    try {
      const { data } = await platformAPI.createSite(newSite);
      setNewSite({ ...blankSite });
      setSiteCredentials({ site: data.site.nom, identifiants: data.identifiantsFiliale });
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Création du site impossible.'); }
  };

  const toggleCards = async () => {
    try { await cartesAPI.setAdminStatus(!cardService?.admin_actif); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Activation du service impossible.'); }
  };

  const updateSite = (index, key, value) => setSites(sites.map((site, current) => (current === index ? { ...site, [key]: value } : site)));

  if (ready === null) return <main className="grid min-h-screen place-items-center bg-[#f7faf8] text-slate-500">Chargement...</main>;

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#f7faf8] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex justify-between">
            <div className="flex gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600"><Building2 className="h-5 w-5 text-white" /></div>
              <div><h1 className="text-xl font-semibold">{PLATFORM_NAME}</h1><p className="text-sm text-slate-500">Espace technique FVS</p></div>
            </div>
            <button onClick={onLogout} className="flex gap-2 text-sm"><LogOut className="w-4" />Déconnexion</button>
          </header>
          {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          <InstallForm {...{ nom, setNom, type, setType, sites, setSites, updateSite, initialize }} />
        </div>
      </main>
    );
  }

  const cardsOn = Boolean(cardService?.admin_actif);
  const current = section.startsWith('cartes-') && !cardsOn ? 'service' : section;
  const menu = [...BASE_MENU, ...(cardsOn ? CARD_MENU : [])];
  const confirmedSites = (cardService?.sites || []).filter((site) => site.confirme_at);

  const navButton = (item, mobile = false) => {
    const Icon = item.icon;
    const on = current === item.id;
    return mobile ? (
      <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-medium transition ${on ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>{item.label}</button>
    ) : (
      <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${on ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{item.label}</button>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7faf8] text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white"><Building2 className="h-5 w-5" /></span>
            <p className="text-sm font-bold text-slate-800">{PLATFORM_NAME}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Administration</p>
          <nav className="space-y-1">{BASE_MENU.map((item) => navButton(item))}</nav>
          {cardsOn && (
            <>
              <p className="mb-3 mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Cartes d’identité scolaire</p>
              <nav className="space-y-1">{CARD_MENU.map((item) => navButton(item))}</nav>
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-100 p-4"><button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"><LogOut className="h-4 w-4" />Déconnexion</button></div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0">
          <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-slate-900">Espace technique FVS</h1>
                <p className="mt-1 truncate text-xs text-slate-500">{overview?.etablissement?.nom}</p>
              </div>
              <div className="flex items-center gap-2">
                {cardsOn && <UnreadBell onError={setError} />}
                {cardsOn && <UnreadLostDeclarationsBell onError={setError} />}
                <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 md:hidden"><LogOut className="h-4 w-4" />Déconnexion</button>
              </div>
            </div>
          </header>
          <nav className="border-b border-slate-200 bg-white px-3 md:hidden"><div className="flex gap-1 overflow-x-auto">{menu.map((item) => navButton(item, true))}</div></nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
            {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
            {credentials && <Credentials title="Identifiants initiaux à remettre" accounts={credentials} />}
            {siteCredentials && <Credentials title={`Identifiants — filiale « ${siteCredentials.site} »`} accounts={siteCredentials.identifiants} />}

            {current === 'tableau' && (
              <div className="space-y-5">
                <div><h2 className="text-2xl font-semibold tracking-tight text-emerald-700">Établissement</h2><p className="mt-1 text-sm text-slate-500">Comptes de gestion, sites et filiales.</p></div>
                <section className="rounded-xl border bg-white p-6">
                  <h3 className="font-semibold">{overview?.etablissement?.nom}</h3>
                  <p className="mt-1 text-sm text-slate-500">Comptes de gestion de l’établissement.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {overview?.comptes?.map((account) => (
                      <div key={account.id} className="rounded-xl border p-4"><Users className="mb-2 w-4 text-emerald-600" /><p className="text-sm font-medium capitalize">{account.role}</p><p className="mt-1 text-xs text-slate-500">{account.status === 'active' ? 'Actif' : account.status}</p></div>
                    ))}
                  </div>
                </section>
                <section className="rounded-xl border bg-white p-6">
                  <h3 className="font-semibold">Sites de l’établissement</h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {overview?.sites?.map((site) => (
                      <div key={site.id} className="rounded-xl border p-4"><MapPin className="mb-2 w-4 text-emerald-600" /><p className="text-sm font-medium">{site.nom}</p><p className="mt-1 text-xs text-slate-500">{site.est_principal ? 'Site principal' : 'Filiale'}</p></div>
                    ))}
                  </div>
                  <form onSubmit={createSite} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2">
                    <Field label="Nouvelle filiale" value={newSite.nom} onChange={(event) => setNewSite({ ...newSite, nom: event.target.value })} required />
                    <Field label="Commune" value={newSite.commune} onChange={(event) => setNewSite({ ...newSite, commune: event.target.value })} />
                    <button className="primary flex justify-center gap-2 sm:col-span-2"><Plus className="w-4" />Ajouter la filiale</button>
                  </form>
                </section>
              </div>
            )}

            {current === 'service' && (
              <div className="space-y-5">
                <div><h2 className="text-2xl font-semibold tracking-tight text-emerald-700">Service Cartes d’identité scolaire</h2><p className="mt-1 text-sm text-slate-500">Autorisez le service, puis la direction confirme les sites concernés.</p></div>
                <section className="rounded-xl border bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="font-semibold">Autorisation</h3><p className="mt-1 text-sm text-slate-500">Une fois autorisé, les sections Classes, Identité et Notifications s’ouvrent dans le menu.</p></div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cardsOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{cardsOn ? 'Autorisé' : 'Non autorisé'}</span>
                  </div>
                  <button type="button" onClick={toggleCards} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{cardsOn ? 'Désactiver le service' : 'Activer services carte d’identité'}</button>
                </section>
                {cardsOn && (
                  <section className="rounded-xl border bg-white p-6">
                    <h3 className="font-semibold">Sites confirmés par la direction</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(cardService?.sites || []).map((site) => (
                        <div key={site.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{site.nom}</p><p className="mt-1 text-xs text-slate-500">{site.est_principal ? 'Site principal' : 'Filiale'}</p></div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${site.confirme_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{site.confirme_at ? 'Confirmé' : 'En attente'}</span>
                        </div>
                      ))}
                    </div>
                    {!confirmedSites.length && <p className="mt-4 text-xs text-amber-700">Aucun site confirmé : la direction doit activer la section Cartes dans son cockpit.</p>}
                  </section>
                )}
              </div>
            )}

            {current.startsWith('cartes-') && <CardAdminPanel section={current} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function Credentials({ title, accounts }) {
  return (
    <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="font-semibold text-amber-950">{title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((account) => (
          <div key={account.role} className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-medium capitalize">{account.role}</p>
            <p className="mt-2 text-xs">Identifiant : {account.username}</p>
            <p className="mt-1 text-xs">Mot de passe : {account.password}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstallForm({ nom, setNom, type, setType, sites, setSites, updateSite, initialize }) {
  return (
    <section className="rounded-xl border bg-white p-6">
      <h2 className="font-semibold">Créer une installation</h2>
      <form onSubmit={initialize} className="mt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l’établissement" value={nom} onChange={(event) => setNom(event.target.value)} required />
          <label className="block text-sm">Type<select className="input" value={type} onChange={(event) => setType(event.target.value)}><option value="primaire">Primaire</option><option value="college">Collège</option></select></label>
        </div>
        <div className="flex justify-between"><h3 className="text-sm font-medium">Sites</h3><button type="button" className="text-sm text-emerald-700" onClick={() => setSites([...sites, { ...blankSite }])}>+ Ajouter une filiale</button></div>
        {sites.map((site, index) => (
          <div key={index} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <Field label={index === 0 ? 'Site principal' : 'Filiale'} value={site.nom} onChange={(event) => updateSite(index, 'nom', event.target.value)} required={index === 0} />
            <Field label="Commune" value={site.commune} onChange={(event) => updateSite(index, 'commune', event.target.value)} />
          </div>
        ))}
        <button className="primary w-full">Créer l’installation</button>
      </form>
    </section>
  );
}

function Field({ label, ...props }) {
  return <label className="block text-sm">{label}<input {...props} className="input" /></label>;
}