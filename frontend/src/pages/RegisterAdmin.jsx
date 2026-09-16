import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authAPI } from '../services/api';
import { PLATFORM_NAME } from '../config/branding';

export default function RegisterAdmin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await authAPI.register(email, password, confirmPassword);
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      onLoginSuccess?.(); navigate('/admin/tableau-de-bord');
    } catch (err) { setError(err.response?.data?.error || 'Impossible de créer le compte.'); }
    finally { setLoading(false); }
  };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><section className="w-full max-w-sm bg-white border rounded-xl p-7"><div className="flex gap-3 mb-6"><span className="bg-emerald-600 text-white p-2 rounded-lg"><ShieldCheck className="w-5 h-5"/></span><div><h1 className="font-semibold">{PLATFORM_NAME}</h1><p className="text-xs text-slate-500">Créer le premier administrateur</p></div></div>{error && <p className="mb-4 text-sm text-rose-700">{error}</p>}<form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Mot de passe<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full border rounded-lg p-2"/><small className="text-slate-500">8 caractères, majuscule, minuscule et chiffre.</small></label><label className="block text-sm">Confirmer le mot de passe<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 w-full border rounded-lg p-2"/></label><button disabled={loading} className="w-full bg-emerald-600 text-white p-2.5 rounded-lg text-sm flex gap-2 justify-center">{loading && <Loader2 className="w-4 animate-spin"/>}{loading ? 'Création…' : 'Créer le compte'}</button></form><button onClick={() => navigate('/admin')} className="mt-5 text-sm text-emerald-700">Retour à la connexion</button></section></main>;
}
