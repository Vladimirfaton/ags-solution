import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate();
  const submit = async (event) => { event.preventDefault(); setError(''); try { await authAPI.resetPassword(params.get('token'), password, confirmPassword); setMessage('Mot de passe modifié. Vous pouvez vous connecter.'); } catch (err) { setError(err.response?.data?.error || 'Lien invalide ou expiré.'); } };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><form onSubmit={submit} className="w-full max-w-sm bg-white border rounded-xl p-7 space-y-4"><h1 className="font-semibold">Nouveau mot de passe</h1>{error && <p className="text-sm text-rose-700">{error}</p>}{message ? <button type="button" onClick={() => navigate('/gestion')} className="text-sm text-emerald-700">{message}</button> : <><label className="block text-sm">Mot de passe<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Confirmer<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 w-full border rounded-lg p-2"/></label><button className="w-full bg-emerald-600 text-white rounded-lg p-2.5 text-sm">Modifier le mot de passe</button></>}</form></main>;
}
