import { query } from '../config/database.js';

export class AcademicMonitoring {
  static async overview(scope) {
   const siteFilter = scope.allSites
     ? { sql: '', params: [] }
     : { sql: ' AND i.site_id = ANY($1::uuid[])', params: [scope.siteIds] };
   const classSiteFilter = scope.allSites
      ? { sql: '', params: [] }
      : { sql: ' AND ca.site_id = ANY($1::uuid[])', params: [scope.siteIds] };
    const [activeYear, totals, classes, movements] = await Promise.all([
      query("SELECT id, libelle, date_debut, date_fin FROM annees_scolaires WHERE statut = 'active'"),
      query(`SELECT COUNT(*) FILTER (WHERE i.statut = 'active')::int AS actifs,
      COUNT(*) FILTER (WHERE i.statut = 'transferee')::int AS transferes,
      COUNT(*) FILTER (WHERE i.statut = 'renvoyee')::int AS renvoyes,
     COUNT(*) FILTER (WHERE i.statut = 'abandonnee')::int AS abandons
      FROM inscriptions i
        WHERE i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${siteFilter.sql}`, siteFilter.params),
     query(`SELECT ca.id, ca.code_affichage, COUNT(ai.id)::int AS effectif
       FROM classes_annuelles ca
       LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
       WHERE ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${classSiteFilter.sql}
       GROUP BY ca.id, ca.code_affichage
       ORDER BY ca.code_affichage ASC`, classSiteFilter.params),
      query(`SELECT mi.type, mi.date_effet, mi.motif, e.matricule, e.nom, e.prenom
      FROM mouvements_inscription mi
       JOIN inscriptions i ON i.id = mi.inscription_id
        JOIN eleves e ON e.id = i.eleve_id
        WHERE i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${siteFilter.sql}
        ORDER BY mi.date_effet DESC, mi.created_at DESC LIMIT 10`, siteFilter.params),
    ]);
    return { activeYear: activeYear.rows[0] || null, totals: totals.rows[0], classes: classes.rows, movements: movements.rows };
  }
}
