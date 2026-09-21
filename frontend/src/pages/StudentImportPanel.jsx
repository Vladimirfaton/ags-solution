import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { comptabiliteAPI } from '../services/api';

export default function StudentImportPanel() {
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const inspect = async (event) => {
    event.preventDefault();
    if (!file) return setError('Sélectionnez un fichier Excel .xlsx.');
    if (file.size > MAX_FILE_SIZE) return setError('Le fichier ne doit pas dépasser 20 Mo.');
    setBusy(true); setError(''); setMessage('');
    try { setPreview((await comptabiliteAPI.previewStudentImport(file)).data); }
    catch (err) { setError(err.response?.data?.error || 'Impossible de lire ce fichier.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = (await comptabiliteAPI.confirmStudentImport(file)).data;
      setMessage(`${result.imported || result.students?.length || 0} élève(s) importé(s) avec succès.`);
      setPreview(null); setFile(null);
    } catch (err) { setError(err.response?.data?.error || 'Import impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><FileSpreadsheet className="h-5 w-5" /></span>
        <div><h3 className="font-semibold text-slate-900">Importer des élèves</h3><p className="mt-1 text-xs leading-5 text-slate-500">Chargez un fichier Excel pour vérifier les lignes avant leur création dans les inscriptions.</p></div>
      </div>
      <form onSubmit={inspect} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fichier Excel (.xlsx)<input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(''); }} className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold" /></label>
        <button disabled={busy || !file} className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />{busy ? 'Analyse…' : 'Analyser le fichier'}</button>
      </form>
      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {preview && <div className="mt-5 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Aperçu de validation</p><p className="mt-1 text-xs text-slate-500">{preview.totalRows} ligne(s) détectée(s) · {preview.rows?.length || 0} ligne(s) prête(s)</p></div><span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${preview.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{preview.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{preview.valid ? 'Fichier valide' : 'Corrections nécessaires'}</span></div>
        {preview.errors?.length > 0 && <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-rose-100 bg-rose-50/60 p-3"><p className="text-xs font-semibold text-rose-800">Erreurs détectées</p><ul className="mt-2 space-y-1 text-xs text-rose-700">{preview.errors.map((item) => <li key={item.line}>Ligne {item.line} : {item.messages.join(' ')}</li>)}</ul></div>}
        {preview.valid && <button type="button" onClick={confirm} disabled={busy} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">Confirmer l’import</button>}
      </div>}
    </section>
  );
}
