import { query } from '../config/database.js';

const baseQuery = (scope, { search = '', classe = '' } = {}) => {
  const params = [];
  let filters = '';
  if (!scope.allSites) {
    params.push(scope.siteIds);
    filters += ` AND i.site_id = ANY($${params.length}::uuid[])`;
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    filters += ` AND (e.matricule ILIKE $${params.length} OR e.nom ILIKE $${params.length} OR e.prenom ILIKE $${params.length} OR ca.code_affichage ILIKE $${params.length})`;
  }
  if (classe) {
    params.push(classe);
    filters += ` AND ca.code_affichage = $${params.length}`;
  }
  const sql = `
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
      AND EXISTS (
        SELECT 1
        FROM plans_tarifaires pt
        JOIN tranches_tarifaires tt ON tt.plan_tarifaire_id = pt.id
          AND tt.id = o.source_config_id AND tt.actif = true
        WHERE pt.annee_scolaire_id = i.annee_scolaire_id
          AND pt.site_id = i.site_id AND pt.classe_id = ca.classe_id
          AND pt.division_nom IS NOT DISTINCT FROM ca.division_nom AND pt.actif = true
      )
      ${filters}
    GROUP BY o.id, e.id, ca.id
    HAVING o.montant_du - COALESCE(SUM(ap.montant_affecte) FILTER (WHERE p.statut = 'confirme'), 0) > 0
  `;
  return { sql, params };
};

const toItem = (row) => {
  const montantPaye = Number(row.montant_paye);
  const montantDu = Number(row.montant_du);
  return {
    obligationId: row.obligation_id, libelle: row.libelle, dateEcheance: row.date_echeance,
    montantDu, montantPaye, reste: montantDu - montantPaye,
    statut: montantPaye > 0 ? 'partiel' : 'impaye',
    matricule: row.matricule, nom: row.nom, prenom: row.prenom,
  };
};

export class OverdueInstallments {
  static async summary(scope, { search = '' } = {}) {
    const { sql, params } = baseQuery(scope, { search });
    const result = await query(`
      WITH overdue AS (${sql})
      SELECT code_affichage AS classe, COUNT(*)::int AS count, SUM(montant_du - montant_paye) AS reste
      FROM overdue
      GROUP BY code_affichage
      ORDER BY code_affichage
    `, params);
    return {
      classes: result.rows.map((row) => ({ classe: row.classe, count: row.count })),
      count: result.rows.reduce((sum, row) => sum + row.count, 0),
      totalReste: result.rows.reduce((sum, row) => sum + Number(row.reste), 0),
    };
  }

  static async pageForClass(scope, { classe, search = '', page = 1, pageSize = 5 }) {
    const { sql, params } = baseQuery(scope, { search, classe });
    const offset = (Math.max(1, page) - 1) * pageSize;
    const [rows, count] = await Promise.all([
      query(`
        WITH overdue AS (${sql})
        SELECT * FROM overdue
        ORDER BY date_echeance ASC, nom, prenom, obligation_id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]),
      query(`WITH overdue AS (${sql}) SELECT COUNT(*)::int AS total FROM overdue`, params),
    ]);
    return { classe, items: rows.rows.map(toItem), total: count.rows[0].total, page, pageSize };
  }

  static async allForClass(scope, { classe }) {
    const { sql, params } = baseQuery(scope, { classe });
    const result = await query(`
      WITH overdue AS (${sql})
      SELECT * FROM overdue ORDER BY date_echeance ASC, nom, prenom, obligation_id
    `, params);
    return result.rows.map(toItem);
  }
}