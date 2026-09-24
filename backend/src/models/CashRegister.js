import { query } from '../config/database.js';

export class CashRegister {
  static async overview(scope) {
    const siteFilter = scope.allSites ? { sql: '', params: [] } : {
      sql: ' AND i.site_id = ANY($1::uuid[])',
      params: [scope.siteIds],
    };
    const [yearTotal, byMode, recent, activeYear, enrolled, overdue] = await Promise.all([
      query(`SELECT COALESCE(SUM(p.montant_encaisse), 0) AS total, COUNT(*)::int AS operations
        FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id
        WHERE p.nature = 'encaissement' AND p.statut = 'confirme'
          AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
          ${siteFilter.sql}`, siteFilter.params),
      query(`SELECT p.mode_paiement, COALESCE(SUM(p.montant_encaisse), 0) AS total FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id WHERE p.nature = 'encaissement' AND p.statut = 'confirme' AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${siteFilter.sql} GROUP BY p.mode_paiement ORDER BY p.mode_paiement`, siteFilter.params),
      query(`SELECT p.id, p.numero_recu, p.mode_paiement, p.montant_encaisse, p.monnaie_rendue, p.created_at, e.matricule, e.nom, e.prenom FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id JOIN eleves e ON e.id = i.eleve_id WHERE p.nature = 'encaissement' AND p.statut = 'confirme'${siteFilter.sql} ORDER BY p.created_at DESC LIMIT 20`, siteFilter.params),
      query("SELECT libelle FROM annees_scolaires WHERE statut = 'active'"),
      query(`SELECT COUNT(*)::int AS count FROM inscriptions i WHERE i.statut = 'active'${siteFilter.sql}`, siteFilter.params),
      query(`
        WITH tranche_totals AS (
          SELECT o.id, o.montant_du,
            COALESCE(SUM(ap.montant_affecte) FILTER (WHERE p.statut = 'confirme'), 0) AS montant_paye
          FROM obligations_financieres o
          JOIN inscriptions i ON i.id = o.inscription_id
          LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
          LEFT JOIN paiements p ON p.id = ap.paiement_id
          WHERE o.type = 'tranche_scolarite' AND o.date_echeance < CURRENT_DATE
            AND i.statut = 'active'
            AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
            ${siteFilter.sql}
          GROUP BY o.id
        )
        SELECT COUNT(*)::int AS count, COALESCE(SUM(GREATEST(montant_du - montant_paye, 0)), 0) AS total_reste
        FROM tranche_totals WHERE montant_du - montant_paye > 0
      `, siteFilter.params),
    ]);
    return {
      today: yearTotal.rows[0], byMode: byMode.rows, recent: recent.rows,
      activeYear: activeYear.rows[0] || null, enrolledStudents: enrolled.rows[0].count,
      overdueInstallments: { count: overdue.rows[0].count, totalReste: Number(overdue.rows[0].total_reste) },
    };
  }
}