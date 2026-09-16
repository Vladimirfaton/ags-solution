import { pool, query } from '../config/database.js';
import { FinancialObligation } from './FinancialObligation.js';
import { resolveScopedSite } from './AccessScope.js';

export class Enrollment {
static async options(scope, requestedSiteId) {
    const [year, siteId] = await Promise.all([
     query("SELECT id, libelle FROM annees_scolaires WHERE statut = 'active'"),
     resolveScopedSite(scope, requestedSiteId),
   ]);
   if (!year.rowCount) return { year: null, students: [], classes: [] };
const studentsQuery = scope.allSites
     ? query(`SELECT e.id, e.matricule, e.nom, e.prenom
         FROM eleves e
         WHERE NOT EXISTS (
           SELECT 1 FROM inscriptions i
           WHERE i.eleve_id = e.id AND i.annee_scolaire_id = $1
         )
         ORDER BY e.nom, e.prenom`, [year.rows[0].id])
     : query(`SELECT e.id, e.matricule, e.nom, e.prenom
          FROM eleves e
         WHERE NOT EXISTS (
            SELECT 1 FROM inscriptions i
            WHERE i.eleve_id = e.id AND i.annee_scolaire_id = $1
          )
         AND EXISTS (
           SELECT 1 FROM inscriptions historique
           WHERE historique.eleve_id = e.id
              AND historique.site_id = ANY($2::uuid[])
          )
         ORDER BY e.nom, e.prenom`, [year.rows[0].id, scope.siteIds]);
    const [students, classes] = await Promise.all([
      studentsQuery,
       query(`SELECT ca.id, ca.code_affichage
       FROM classes_annuelles ca
       JOIN classes c ON c.id = ca.classe_id
        JOIN niveaux_scolaires n ON n.code = c.niveau_code
       WHERE ca.annee_scolaire_id = $1 AND ca.site_id = $2 AND ca.actif = true
        ORDER BY n.ordre, ca.division_nom`, [year.rows[0].id, siteId]),
    ]);
   return { year: year.rows[0], siteId, students: students.rows, classes: classes.rows };
  }
    static async create({ studentId, annualClassId, siteId: requestedSiteId }, userId, scope) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const siteId = await resolveScopedSite(scope, requestedSiteId);
    const context = await client.query("SELECT id AS annee_id FROM annees_scolaires WHERE statut = 'active'");
    if (!context.rowCount) throw Object.assign(new Error('Aucune année scolaire active.'), { status: 400, expose: true });
    const yearId = context.rows[0].annee_id;
      const student = await client.query(`SELECT e.id FROM eleves e
        WHERE e.id = $1 AND NOT EXISTS (SELECT 1 FROM inscriptions i WHERE i.eleve_id = e.id AND i.annee_scolaire_id = $2)`, [studentId, yearId]);
      if (!student.rowCount) throw Object.assign(new Error('Cet élève est déjà inscrit ou introuvable.'), { status: 409, expose: true });
      const annualClass = await client.query(`SELECT id FROM classes_annuelles
        WHERE id = $1 AND annee_scolaire_id = $2 AND site_id = $3 AND actif = true`, [annualClassId, yearId, siteId]);
      if (!annualClass.rowCount) throw Object.assign(new Error('Classe annuelle invalide.'), { status: 400, expose: true });
      const inscription = await client.query(`INSERT INTO inscriptions (eleve_id, annee_scolaire_id, site_id, type_inscription, created_by)
        VALUES ($1,$2,$3,'reinscription',$4) RETURNING id, statut, date_inscription`, [studentId, yearId, siteId, userId]);
      await client.query('INSERT INTO affectations_inscription (inscription_id, classe_annuelle_id, created_by) VALUES ($1,$2,$3)', [inscription.rows[0].id, annualClassId, userId]);
      await FinancialObligation.createForEnrollment(client, { inscriptionId: inscription.rows[0].id, anneeScolaireId: yearId, siteId, typeInscription: 'reinscription' });
      await client.query('COMMIT');
      return inscription.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
