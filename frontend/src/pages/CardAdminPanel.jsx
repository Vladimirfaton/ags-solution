import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Loader2, MapPin, School, Search, Users, X } from 'lucide-react';
import { cartesAPI } from '../services/api';
import CardClassPanel from './CardClassPanel';
import { Empty, NotifyMenu, StatCard, TextInput, formatDateTime, norm, signatureUrl, sortClasses } from '../components/CardAdminShared';

const TYPE_LABELS = { brouillon_pret: 'Brouillon prêt', cartes_pretes: 'Cartes prêtes' };

function IdentitySection({ onNotice, onError }) {
  const [identity, setIdentity] = useState(null);
  const [slogan, setSlogan] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    cartesAPI.getIdentity()
      .then(({ data }) => { setIdentity(data.identite); setSlogan(data.identite?.slogan || ''); })
      .catch(() => onError('Impossible de charger l’identité de l’établissement.'));
  }, []);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : signatureUrl(identity?.signature_path)), [file, identity]);

  const save = async () => {
    setSaving(true);
    try {
      let next = (await cartesAPI.updateIdentity(slogan)).data.identite;
      if (file) {
        next = (await cartesAPI.uploadSignature(file)).data.identite;
        setFile(null);
        if (input.current) input.current.value = '';
      }
      setIdentity(next);
      onNotice('Identité des cartes enregistrée.');
    } catch (err) {
      onError(err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-800">{identity?.nom || 'Établissement'}</p>
      <p className="mb-5 mt-1 text-xs text-slate-500">Ces informations sont imprimées sur toutes les cartes. La signature apparaît au verso, avec le nom du directeur.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Slogan (optionnel)" value={slogan} onChange={setSlogan} placeholder="Prière - Travail - Excellence" />
        <label className="block text-xs font-medium text-slate-600">Signature du directeur (PNG/JPEG, 2 Mo)
          <input ref={input} type="file" accept="image/png,image/jpeg" onChange={(event) => setFile(event.target.files[0] || null)} className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700" />
        </label>
      </div>
      {preview && <div className="mt-4 inline-block rounded-lg border border-slate-200 bg-slate-50 p-3"><img src={preview} alt="Signature" style={{ maxWidth: 200, maxHeight: 80 }} /></div>}
      <div className="mt-5">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </div>
  );
}

function NotificationsSection({ onError }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    cartesAPI.listNotifications()
      .then(({ data }) => setRows(data.notifications || []))
      .catch(() => { setRows([]); onError('Impossible de charger l’historique.'); });
  }, []);

  if (rows === null) return <div className="flex items-center py-10 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="text-sm">Chargement</span></div>;
  if (!rows.length) return <Empty>Aucune notification envoyée pour le moment.</Empty>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr className="text-left text-xs font-medium text-slate-500"><th className="px-4 py-3">Type</th><th className="px-4 py-3">Site</th><th className="px-4 py-3">Classe</th><th className="px-4 py-3">Passage</th><th className="px-4 py-3">Emails</th><th className="px-4 py-3">Envoyée le</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-800">{TYPE_LABELS[row.type] || row.type}</td>
              <td className="px-4 py-3 text-slate-600">{row.site_nom}</td>
              <td className="px-4 py-3 text-slate-600">{row.classe_code || 'Tout le site'}</td>
              <td className="px-4 py-3 text-slate-600">{row.type === 'cartes_pretes' ? formatDateTime(row.date_passage) : '—'}</td>
              <td className="px-4 py-3 text-slate-600">{row.emails_envoyes}</td>
              <td className="px-4 py-3 text-slate-600">{formatDateTime(row.sent_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassesSection({ classes, loading, onNotice, onError }) {
  const [site, setSite] = useState(null);
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');

  const sites = useMemo(() => {
    const map = new Map();
    for (const item of classes) {
      if (!map.has(item.site_id)) map.set(item.site_id, { id: item.site_id, nom: item.site_nom, classes: 0, eleves: 0 });
      const entry = map.get(item.site_id);
      entry.classes += 1;
      entry.eleves += Number(item.effectif || 0);
    }
    return [...map.values()];
  }, [classes]);

  const siteClasses = useMemo(() => {
    if (!site) return [];
    const term = norm(search.trim());
    return sortClasses(classes.filter((item) => item.site_id === site.id && (!term || norm(item.code_affichage).includes(term))));
  }, [classes, site, search]);

  const totalStudents = sites.reduce((sum, entry) => sum + entry.eleves, 0);

  if (loading) return <div className="flex items-center py-10 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="text-sm">Chargement</span></div>;

  if (active) {
    return (
      <div>
        <div className="mb-5 flex items-center gap-2 text-sm">
          <button type="button" onClick={() => setActive(null)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Retour</button>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-700">{site?.nom}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-emerald-700">{active.code_affichage}</span>
        </div>
        <CardClassPanel item={active} onNotice={onNotice} onError={onError} />
      </div>
    );
  }

  if (site) {
    return (
      <div>
        <div className="mb-5 flex items-center gap-2 text-sm">
          <button type="button" onClick={() => { setSite(null); setSearch(''); }} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Retour</button>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-700">{site.nom}</span>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <School className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate text-sm font-semibold text-slate-800">{site.nom}</span>
            <span className="shrink-0 text-xs text-slate-400">{site.classes} classe{site.classes > 1 ? 's' : ''}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une classe" className="w-52 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <NotifyMenu siteId={site.id} onNotice={onNotice} onError={onError} />
        </div>
        {!siteClasses.length ? <Empty>{search.trim() ? `Aucune classe ne correspond à « ${search} ».` : 'Aucune classe sur ce site.'}</Empty> : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {siteClasses.map((item) => (
              <button key={item.id} type="button" onClick={() => setActive(item)} className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300">
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-base font-semibold text-slate-800 transition group-hover:text-emerald-700">{item.code_affichage}</span>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400 transition group-hover:text-emerald-600" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{item.effectif ?? 0} élève{(item.effectif ?? 0) > 1 ? 's' : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={MapPin} label="Sites confirmés" value={sites.length} tone="emerald" />
        <StatCard icon={School} label="Classes" value={classes.length} tone="cyan" />
        <StatCard icon={Users} label="Élèves" value={totalStudents} tone="violet" />
      </div>
      {!sites.length ? <Empty>Aucune classe : la direction n’a confirmé aucun site, ou l’année active n’a pas de classes.</Empty> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sites.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setSite(entry)} className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50"><School className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 transition group-hover:text-emerald-700">{entry.nom}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{entry.classes} classe(s) · {entry.eleves} élève(s)</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 pl-12 text-xs font-medium text-emerald-700">Voir les classes<ChevronRight className="h-3.5 w-3.5" /></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TITLES = {
  'cartes-classes': ['Classes et élèves', 'Sites confirmés par la direction : listes, brouillons et génération des cartes.'],
  'cartes-identite': ['Identité des cartes', 'Slogan et signature imprimés sur les cartes de l’établissement.'],
  'cartes-notifications': ['Notifications', 'Historique des notifications « brouillon prêt » et « cartes prêtes ».'],
};

export default function CardAdminPanel({ section }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const flashNotice = (message) => { setError(''); setNotice(message); setTimeout(() => setNotice(''), 5000); };
  const flashError = (message) => { setNotice(''); setError(message); setTimeout(() => setError(''), 8000); };

  useEffect(() => {
    cartesAPI.adminClasses()
      .then(({ data }) => setClasses(data.classes || []))
      .catch((err) => flashError(err.response?.data?.error || 'Impossible de charger les classes Cartes.'))
      .finally(() => setLoading(false));
  }, []);

  const [title, subtitle] = TITLES[section] || TITLES['cartes-classes'];

  return (
    <div>
      {(error || notice) && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4">
          <div className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-5 py-4 text-sm font-medium shadow-lg ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <X className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}<span>{error || notice}</span>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-emerald-700">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {section === 'cartes-identite' ? <IdentitySection onNotice={flashNotice} onError={flashError} />
        : section === 'cartes-notifications' ? <NotificationsSection onError={flashError} />
        : <ClassesSection classes={classes} loading={loading} onNotice={flashNotice} onError={flashError} />}
    </div>
  );
}