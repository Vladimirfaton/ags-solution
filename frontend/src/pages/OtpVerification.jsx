import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IdCard, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import { PLATFORM_NAME } from '../config/branding';

export default function OtpVerification({ onLoginSuccess }) {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
    else navigate('/admin');
  }, [location, navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (otpCode.length !== 6) {
      setError('Entrez un code à 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email, otpCode);
      const { token, user } = res.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      onLoginSuccess?.();
      navigate('/admin/tableau-de-bord');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    setResending(true);
    try {
      await authAPI.resendOtp(email);
      setTimeLeft(180);
      setOtpCode('');
      setNotice('Un nouveau code a été envoyé');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi du code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center px-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
            <IdCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 leading-tight">{PLATFORM_NAME}</h1>
            <p className="text-xs text-slate-500">Vérification de connexion</p>
          </div>
        </div>

        <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800">
          Code envoyé à <span className="font-medium">{email}</span>
          <div className="text-emerald-600 mt-1">
            {timeLeft > 0 ? `Valide encore ${formatTime(timeLeft)}` : 'Code expiré'}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
            {notice}
          </div>
        )}

        <form onSubmit={submit}>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Code à 6 chiffres</label>
          <input
            type="text"
            value={otpCode}
            onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            disabled={timeLeft <= 0}
            placeholder="000000"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-2xl font-semibold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            required
          />

          <button
            type="submit"
            disabled={loading || timeLeft <= 0}
            className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Vérification' : 'Vérifier le code'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={resend}
            disabled={resending}
            className="text-sm text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer disabled:opacity-50"
          >
            {resending ? 'Envoi...' : 'Renvoyer le code'}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}
