import 'dotenv/config';
import { pool, query } from '../config/database.js';
import { Establishment } from '../models/Establishment.js';
import { Enrollment } from '../models/Enrollment.js';

const scope = { allSites: true, siteIds: [] };
const log = (label, value) => console.log(`\n${label} :`, value);

async function run() {
  const activeBefore = await query("SELECT id, libelle, date_debut, date_fin FROM annees_scolaires WHERE statut = 'active'");
  if (!activeBefore.rowCount) throw new Error('Aucune année active à tester.');
  const original = activeBefore.rows[0];
  log('Année active avant test', original);

  const outgoingInscriptions = await query("SELECT id FROM inscriptions WHERE annee_scolaire_id = $1 AND statut = 'active'", [original.id]);
  const outgoingIds = outgoingInscriptions.rows.map((row) => row.id);
  log('Inscriptions actives à restaurer après test', outgoingIds.length);

  const nextYearStart = new Date(original.date_fin);
  nextYearStart.setUTCMonth(nextYearStart.getUTCMonth() + 3);
  const moisDebut = `${nextYearStart.getUTCFullYear()}-09`;
  const moisFin = `${nextYearStart.getUTCFullYear() + 1}-06`;
  const libelle = `TEST-${Date.now()}`;

  log('Création du brouillon de test', { libelle, moisDebut, moisFin });
  const draft = await Establishment.createSchoolYear({ libelle, moisDebut, moisFin });
  log('Brouillon créé', draft);

  try {
    const copiedClasses = await Establishment.listYearClasses(draft.id);
    log('Classes copiées dans le brouillon', copiedClasses.length);

    log('Activation du brouillon', 'en cours...');
    const activated = await Establishment.activateSchoolYear(draft.id);
    log('Année activée', activated);

    const statusCheck = await query('SELECT statut, COUNT(*)::int AS total FROM inscriptions WHERE annee_scolaire_id = $1 GROUP BY statut', [original.id]);
    log("Statuts des inscriptions de l'ancienne année après activation", statusCheck.rows);

    const enrollmentOptions = await Enrollment.options(scope);
    log('Élèves candidats à la réinscription', enrollmentOptions.students.length);

    if (enrollmentOptions.students.length) {
      const sample = enrollmentOptions.students[0];
      log('Élève testé', sample);
      const classes = await Enrollment.classesForStudent(sample.id, scope);
      log('Classes proposées pour cet élève', classes);
    } else {
      console.log('\nAucun élève candidat trouvé — vérifier la copie de configuration.');
    }
  } finally {
    console.log("\nRestauration de l'état initial...");
    await query("UPDATE inscriptions SET statut = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])", [outgoingIds]);
    await query('DELETE FROM annees_scolaires WHERE id = $1', [draft.id]);
    await query("UPDATE annees_scolaires SET statut = 'active', cloturee_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [original.id]);
    const finalCheck = await query('SELECT id, libelle, statut FROM annees_scolaires WHERE id = $1', [original.id]);
    log("État final de l'année restaurée", finalCheck.rows[0]);
    const activeCount = await query("SELECT COUNT(*)::int AS total FROM annees_scolaires WHERE statut = 'active'");
    log('Nombre d\'années actives après restauration (doit être 1)', activeCount.rows[0].total);
  }
}

if (!process.argv.includes('--confirm')) {
  console.log("Ce script active temporairement une nouvelle année scolaire puis restaure l'état initial automatiquement.");
  console.log("À exécuter uniquement hors des heures d'utilisation de la plateforme.");
  console.log("Relancez avec --confirm pour l'exécuter réellement.");
  process.exit(0);
}

run()
  .then(() => {
    console.log('\nTest terminé avec succès, état initial restauré.');
    return pool.end();
  })
  .catch(async (error) => {
    console.error("\nERREUR — vérifiez manuellement l'état de la base avant de relancer la plateforme.", error);
    await pool.end();
    process.exit(1);
  });