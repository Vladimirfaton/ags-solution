import { useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { assistanceAPI } from '../services/api';

export default function AssistancePanel({ user: currentUser, establishmentName }) {
  const user = currentUser || JSON.parse(sessionStorage.getItem('user') || '{}');
  const [form, setForm] = useState({ objet: '', message: '' });
  const [status, setStatus] = useState({ error: '', success: '' });
  const [loading, setLoading] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setStatus({ error: '', success: '' });
    try {
      await assistanceAPI.send({ ...form, collegeNom: establishmentName, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role });
      setForm({ objet: '', message: '' });
      setStatus({ error: '', success: 'Votre demande a été transmise à l’assistance.' });
    } catch (err) { setStatus({ error: err.response?.data?.error || 'Impossible d’envoyer votre demande.', success: '' }); }
    finally { setLoading(false); }
  };
  return <div className="max-w-2xl space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Support</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Assistance</h2><p className="mt-1 text-sm text-slate-500">Décrivez votre besoin, l’équipe support vous répondra par email.</p></div><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><LifeBuoy className="h-5 w-5" /></span><div><h3 className="font-semibold text-slate-900">Nouvelle demande</h3><p className="text-xs text-slate-500">Envoyée au support FVS</p></div></div>{status.error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{status.error}</div>}{status.success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status.success}</div>}<form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Objet<input value={form.objet} onChange={set('objet')} required className="input" placeholder="Ex. problème avec une inscription" /></label><label className="block text-sm font-medium text-slate-700">Message<textarea value={form.message} onChange={set('message')} required rows={6} className="input resize-y" placeholder="Décrivez les étapes et le résultat observé." /></label><button disabled={loading} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Send className="h-4 w-4" />{loading ? 'Envoi…' : 'Envoyer la demande'}</button></form></section></div>;
}
