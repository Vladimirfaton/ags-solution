import { pool, query } from '../config/database.js';
import { FinancialObligation } from './FinancialObligation.js';
import { resolveScopedSite } from './AccessScope.js';
import { allowedLevelCodes } from '../utils/establishmentType.js';

export class Enrollment {
static async options(scope, requestedSiteId) {
    const [year, siteId] = await Promise.all([
     query("SELECT id, libelle FROM annees_scolaires WHERE statut = 'active'"),
     resolveScopedSite(scope, requestedSiteId),
   ]);
   if (!year.rowCount) return { year: null, students: [], classes: [] };
   const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
   const levels = allowedLevelCodes(establishment.rows[0]?.type);
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
        JOIN niveaux_scolaires n ON n.id = c.niveau_id
       WHERE ca.annee_scolaire_id = $1 AND ca.site_id = $2 AND ca.actif = true AND n.code = ANY($3::text[])
        ORDER BY n.ordre, ca.division_nom`, [year.rows[0].id, siteId, levels]),
    ]);
   return { year: year.rows[0], siteId, students: students.rows, classes: classes.rows };
  }
  static async classesForStudent(studentId, scope) {
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const levels = allowedLevelCodes(establishment.rows[0]?.type);
    const siteFilter = scope.allSites ? '' : ' AND ca.site_id = ANY($2::uuid[])';
    const result = await query(`WITH derniere AS (
        SELECT ca.site_id, n.ordre
        FROM inscriptions i
        JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
        JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
        JOIN classes c ON c.id = ca.classe_id
        JOIN niveaux_scolaires n ON n.id = c.niveau_id
        WHERE i.eleve_id = $1
        ORDER BY i.date_inscription DESC
        LIMIT 1
      ),
      niveau_suivant AS (
        SELECT MIN(ordre) AS ordre FROM niveaux_scolaires WHERE ordre > (SELECT ordre FROM derniere)
      )
      SELECT ca.id, ca.code_affichage, n.ordre
      FROM classes_annuelles ca
      JOIN classes c ON c.id = ca.classe_id
      JOIN niveaux_scolaires n ON n.id = c.niveau_id
      JOIN derniere d ON ca.site_id = d.site_id
      WHERE ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        AND ca.actif = true
        AND n.code = ANY($${scope.allSites ? 2 : 3}::text[])
        AND (n.ordre = d.ordre OR n.ordre = (SELECT ordre FROM niveau_suivant))${siteFilter}
      ORDER BY n.ordre, ca.division_nom`,
    scope.allSites ? [studentId, levels] : [studentId, scope.siteIds, levels]);
    return result.rows;
  }
    static async create({ studentId, annualClassId, siteId: requestedSiteId, paidFeeConfigIds }, userId, scope) {
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
      const obligations = await FinancialObligation.createForEnrollment(client, { inscriptionId: inscription.rows[0].id, anneeScolaireId: yearId, siteId, typeInscription: 'reinscription' });
      await FinancialObligation.settleFees(client, { inscriptionId: inscription.rows[0].id, obligations, paidFeeConfigIds, userId });
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
