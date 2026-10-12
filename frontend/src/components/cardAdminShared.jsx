import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, CreditCard, Loader2, Send } from 'lucide-react';
import { cartesAPI, FILE_BASE_URL } from '../services/api';

export const norm = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const resolveFileUrl = (value, folder) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${FILE_BASE_URL}/uploads/${folder}/${value.split(/[\\/]/).pop()}`;
};

export const photoUrl = (value) => resolveFileUrl(value, 'photos');
export const signatureUrl = (value) => resolveFileUrl(value, 'signatures');

export const formatDateFr = (value) => {
  if (!value) return '';
  const found = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return found ? `${found[3]}/${found[2]}/${found[1]}` : String(value);
};

export const formatDateTime = (value) => (value
  ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const RANKS = { ci: 1, cp: 2, ce1: 3, ce2: 4, cm1: 5, cm2: 6, 6: 10, 5: 11, 4: 12, 3: 13, '2nde': 14, '2nd': 14, seconde: 14, '1ere': 15, '1re': 15, tle: 16, terminale: 16 };

const classRank = (value = '') => {
  const level = norm(value);
  const found = level.match(/(?:^|\s)(ci|cp|ce1|ce2|cm1|cm2|6|5|4|3)(?:e|eme)?|(?:^|\s)(2nde|2nd|seconde|1ere|1re|tle|terminale)/);
  return RANKS[found?.[1] || found?.[2] || ''] || 99;
};

export const sortClasses = (classes = []) => [...classes].sort((a, b) => (
  classRank(a.code_affichage) - classRank(b.code_affichage)
  || a.code_affichage.localeCompare(b.code_affichage, 'fr', { numeric: true, sensitivity: 'base' })
));

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
};

export function StatCard({ icon: Icon, label, value, tone = 'emerald' }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-2xl font-semibold leading-tight text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-500">{children}</p></div>;
}

export function TextInput({ label, value, onChange, type = 'text', placeholder, required, disabled }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:text-slate-400"
      />
    </div>
  );
}

export function UnreadBell({ onError }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const load = () => cartesAPI.unreadObservations().then(({ data }) => setItems(data.observations || [])).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const markRead = async () => {
    try { await cartesAPI.markObservationsRead(); setItems([]); setOpen(false); } catch { onError('Mise à jour impossible.'); }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="Observations non lues">
        <Bell className="h-4 w-4" />
        {items.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Observations{items.length > 0 && <span className="ml-2 text-xs font-medium text-rose-500">{items.length} non lue{items.length > 1 ? 's' : ''}</span>}</span>
            {items.length > 0 && <button type="button" onClick={markRead} className="text-xs font-medium text-emerald-600">Tout marquer lu</button>}
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Aucune observation non lue</p> : items.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-emerald-700">{item.site_nom} · {item.classe_code}</span><span className="shrink-0 text-slate-400">{formatDateTime(item.created_at)}</span></div>
                <div className="mb-1 text-xs text-slate-500">{item.auteur_prenom || item.auteur_nom ? `${item.auteur_prenom || ''} ${item.auteur_nom || ''}`.trim() : item.auteur_role}</div>
                <p className="line-clamp-2 text-sm text-slate-700">{item.contenu}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotifyMenu({ siteId, classId, onNotice, onError }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [date, setDate] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const send = async (type) => {
    if (type === 'cartes' && !date) { onError('Renseignez la date et l’heure de passage.'); return; }
    const scope = classId ? 'de cette classe' : 'de ce site';
    if (!window.confirm(type === 'cartes' ? `Notifier que les cartes ${scope} sont prêtes ?` : `Notifier que le brouillon ${scope} est prêt ?`)) return;
    setBusy(type);
    try {
      const { data } = await cartesAPI.sendNotification({
        type,
        ...(classId ? { classeAnnuelleId: classId } : { siteId }),
        ...(type === 'cartes' ? { datePassage: new Date(date).toISOString() } : {}),
      });
      onNotice(`Notification envoyée (${data.sent} email${data.sent > 1 ? 's' : ''}).`);
      setOpen(false);
      setDate('');
    } catch (err) {
      onError(err.response?.data?.error || 'Envoi impossible.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300">
        <Bell className="h-4 w-4" />Notifications
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <button type="button" onClick={() => send('brouillon')} disabled={!!busy} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy === 'brouillon' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-slate-400" />}Notifier brouillon prêt
          </button>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-700"><CreditCard className="h-4 w-4 text-slate-400" />Cartes prêtes</p>
            <label className="mb-1 block text-xs text-slate-500">Date et heure de passage</label>
            <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button type="button" onClick={() => send('cartes')} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">
              {busy === 'cartes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}