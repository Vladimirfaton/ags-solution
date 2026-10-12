import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cartesAPI } from '../services/api';

export default function ObservationsPanel({ classId, readOnly = false, currentUserId = null, isAdmin = false }) {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    cartesAPI.listObservations(classId)
      .then((res) => setObservations(res.data?.observations || []))
      .catch(() => setObservations([]))
      .finally(() => setLoading(false));
  }, [classId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await cartesAPI.createObservation(classId, content.trim());
      setObservations((current) => [res.data.observation, ...current]);
      setContent('');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout de l'observation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (observation) => {
    if (!window.confirm('Supprimer cette observation ?')) return;
    try {
      await cartesAPI.deleteObservation(observation.id);
      setObservations((current) => current.filter((item) => item.id !== observation.id));
    } catch (err) {
      window.alert(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const canDelete = (observation) => {
    if (isAdmin) return true;
    if (!currentUserId || observation.auteur_id !== currentUserId) return false;
    return Date.now() - new Date(observation.created_at).getTime() <= 30 * 60 * 1000;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Observations</h3>

      {!readOnly && (
        <form onSubmit={handleSubmit} className="mb-5">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Ajouter une observation (ex : correction du nom, photo manquante)"
            rows={3}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
            >
              {submitting ? 'Envoi...' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : observations.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune observation pour cette classe.</p>
      ) : (
        <ul className="space-y-3">
          {observations.map((item) => (
            <li key={item.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-slate-400 mb-1">
                  {item.auteur_prenom || item.auteur_nom
                    ? `${item.auteur_prenom || ''} ${item.auteur_nom || ''}`.trim()
                    : item.auteur_role || 'Utilisateur'}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {new Date(item.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {canDelete(item) && (
                  <button onClick={() => handleDelete(item)} className="p-1 text-slate-300 hover:text-rose-500 shrink-0" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-sm text-slate-700">{item.contenu}</div>
              {item.eleve_nom && (
                <div className="text-xs text-emerald-600 mt-1">
                  Élève : {item.eleve_prenom} {item.eleve_nom} ({item.eleve_matricule})
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}