import { query } from '../config/database.js';

export class OverdueInstallments {
  static async list(scope, { search = '' } = {}) {
    const siteFilter = scope.allSites ? { sql: '', params: [] } : {
      sql: ' AND i.site_id = ANY($1::uuid[])',
      params: [scope.siteIds],
    };
    const params = [...siteFilter.params];
    let searchFilter = '';
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      searchFilter = ` AND (e.matricule ILIKE $${params.length} OR e.nom ILIKE $${params.length} OR e.prenom ILIKE $${params.length} OR ca.code_affichage ILIKE $${params.length})`;
    }

    const result = await query(`
      SELECT o.id AS obligation_id, o.libelle, o.date_echeance, o.montant_du,
        COALESCE(SUM(ap.montant_affecte) FILTER (WHERE p.statut = 'confirme'), 0) AS montant_paye,
        e.matricule, e.nom, e.prenom, ca.code_affichage
      FROM obligations_financieres o
      JOIN inscriptions i ON i.id = o.inscription_id
      JOIN eleves e ON e.id = i.eleve_id
      JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
      JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
      LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
      LEFT JOIN paiements p ON p.id = ap.paiement_id
      WHERE o.type = 'tranche_scolarite' AND o.date_echeance < CURRENT_DATE
        AND i.statut = 'active'
        AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        ${siteFilter.sql}${searchFilter}
      GROUP BY o.id, e.id, ca.id
      HAVING o.montant_du - COALESCE(SUM(ap.montant_affecte) FILTER (WHERE p.statut = 'confirme'), 0) > 0
      ORDER BY o.date_echeance ASC, ca.code_affichage, e.nom, e.prenom
    `, params);

    const byClass = new Map();
    for (const row of result.rows) {
      if (!byClass.has(row.code_affichage)) byClass.set(row.code_affichage, []);
      const montantPaye = Number(row.montant_paye);
      const montantDu = Number(row.montant_du);
      byClass.get(row.code_affichage).push({
        obligationId: row.obligation_id, libelle: row.libelle, dateEcheance: row.date_echeance,
        montantDu, montantPaye, reste: montantDu - montantPaye,
        statut: montantPaye > 0 ? 'partiel' : 'impaye',
        matricule: row.matricule, nom: row.nom, prenom: row.prenom,
      });
    }

    return {
      classes: [...byClass.entries()].map(([classe, items]) => ({ classe, items })),
      count: result.rowCount,
      totalReste: result.rows.reduce((sum, row) => sum + (Number(row.montant_du) - Number(row.montant_paye)), 0),
    };
  }
}