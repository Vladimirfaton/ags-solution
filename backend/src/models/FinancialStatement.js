import { query } from '../config/database.js';
import { resolveScopedSite } from './AccessScope.js';
import { allowedLevelCodes } from '../utils/establishmentType.js';

const amount = (value) => Math.round(Number(value) * 100) / 100;

const buildFilters = (scope, { search = '', classeAnnuelleId = null } = {}, startIndex) => {
  const clauses = [];
  const params = [];
  let i = startIndex;

  if (search.trim()) {
    clauses.push(`(e.matricule ILIKE $${i} OR e.nom ILIKE $${i} OR e.prenom ILIKE $${i} OR ca.code_affichage ILIKE $${i})`);
    params.push(`%${search.trim()}%`);
    i++;
  }
  if (classeAnnuelleId) {
    clauses.push(`ca.id = $${i}`);
    params.push(classeAnnuelleId);
    i++;
  }
  if (!scope.allSites) {
    clauses.push(`ca.site_id = ANY($${i}::uuid[])`);
    params.push(scope.siteIds);
    i++;
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
};

const baseCte = (filterSql) => `
  WITH totals AS (
    SELECT i.id AS inscription_id, e.matricule, e.nom, e.prenom, ca.code_affichage, ca.id AS classe_annuelle_id,
      n.ordre, ca.division_nom,
      COALESCE(due.total_du, 0) AS total_du,
      COALESCE(paid.total_paye, 0) AS total_paye,
      COALESCE(fees.impayes, 0) AS frais_impayes
    FROM inscriptions i
    JOIN eleves e ON e.id = i.eleve_id
    JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
    JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
    JOIN classes c ON c.id = ca.classe_id
    JOIN niveaux_scolaires n ON n.id = c.niveau_id
    LEFT JOIN (
      SELECT o.inscription_id, SUM(o.montant_du) AS total_du
      FROM obligations_financieres o
      WHERE o.type = 'tranche_scolarite'
        AND EXISTS (
          SELECT 1
          FROM inscriptions i2
          JOIN affectations_inscription ai2 ON ai2.inscription_id = i2.id AND ai2.active = true
          JOIN classes_annuelles ca2 ON ca2.id = ai2.classe_annuelle_id
          JOIN plans_tarifaires pt2 ON pt2.annee_scolaire_id = i2.annee_scolaire_id
            AND pt2.site_id = i2.site_id AND pt2.classe_id = ca2.classe_id
            AND pt2.division_nom IS NOT DISTINCT FROM ca2.division_nom AND pt2.actif = true
          JOIN tranches_tarifaires tt2 ON tt2.plan_tarifaire_id = pt2.id
            AND tt2.actif = true AND tt2.id = o.source_config_id
          WHERE i2.id = o.inscription_id
        )
      GROUP BY o.inscription_id
    ) due ON due.inscription_id = i.id
    LEFT JOIN (
      SELECT o.inscription_id, SUM(ap.montant_affecte) AS total_paye
      FROM obligations_financieres o
      JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
      JOIN paiements p ON p.id = ap.paiement_id AND p.statut = 'confirme'
      WHERE o.type = 'tranche_scolarite'
        AND EXISTS (
          SELECT 1
          FROM inscriptions i2
          JOIN affectations_inscription ai2 ON ai2.inscription_id = i2.id AND ai2.active = true
          JOIN classes_annuelles ca2 ON ca2.id = ai2.classe_annuelle_id
          JOIN plans_tarifaires pt2 ON pt2.annee_scolaire_id = i2.annee_scolaire_id
            AND pt2.site_id = i2.site_id AND pt2.classe_id = ca2.classe_id
            AND pt2.division_nom IS NOT DISTINCT FROM ca2.division_nom AND pt2.actif = true
          JOIN tranches_tarifaires tt2 ON tt2.plan_tarifaire_id = pt2.id
            AND tt2.actif = true AND tt2.id = o.source_config_id
          WHERE i2.id = o.inscription_id
        )
      GROUP BY o.inscription_id
    ) paid ON paid.inscription_id = i.id
    LEFT JOIN (
      SELECT o.inscription_id, COUNT(*)::int AS impayes
      FROM obligations_financieres o
      LEFT JOIN (
        SELECT ap.obligation_financiere_id, SUM(ap.montant_affecte) AS paye
        FROM affectations_paiement ap
        JOIN paiements p ON p.id = ap.paiement_id AND p.statut = 'confirme'
        GROUP BY ap.obligation_financiere_id
      ) pf ON pf.obligation_financiere_id = o.id
      WHERE o.type = 'frais_general' AND o.obligatoire = true AND o.montant_du - COALESCE(pf.paye, 0) > 0
        AND EXISTS (
          SELECT 1 FROM inscriptions i2
          JOIN frais_generaux_config fg ON fg.id = o.source_config_id
            AND fg.annee_scolaire_id = i2.annee_scolaire_id
            AND fg.site_id = i2.site_id AND fg.actif = true
          WHERE i2.id = o.inscription_id
        )
      GROUP BY o.inscription_id
    ) fees ON fees.inscription_id = i.id
    WHERE i.statut = 'active'
      AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
      AND n.code = ANY($1::text[])
      ${filterSql}
  ),
  computed AS (
    SELECT *, GREATEST(total_du - total_paye, 0) AS reste,
      CASE WHEN total_du - total_paye <= 0 THEN 'solde'
           WHEN total_paye > 0 THEN 'partiel'
           ELSE 'impaye' END AS statut
    FROM totals
  )
`;

export class FinancialStatement {
  static async studentDetails(studentId, scope) {
    const siteFilter = scope.allSites ? { sql: '', params: [] } : { sql: ' AND i.site_id = ANY($2::uuid[])', params: [scope.siteIds] };
    const result = await query(`
      SELECT e.id, e.matricule, e.nom, e.prenom, e.sexe, ca.code_affichage AS classe,
        a.libelle AS annee, o.id AS obligation_id, o.libelle, o.montant_du,
        TO_CHAR(o.date_echeance, 'YYYY-MM-DD') AS date_echeance,
        COALESCE(SUM(ap.montant_affecte) FILTER (WHERE p.statut = 'confirme'), 0) AS montant_paye
      FROM eleves e
      JOIN inscriptions i ON i.eleve_id = e.id AND i.statut = 'active'
        AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${siteFilter.sql}
      JOIN annees_scolaires a ON a.id = i.annee_scolaire_id
      LEFT JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
      LEFT JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
      LEFT JOIN obligations_financieres o ON o.inscription_id = i.id
        AND o.type = 'tranche_scolarite'
        AND EXISTS (
          SELECT 1
          FROM affectations_inscription ai_current
          JOIN classes_annuelles ca_current ON ca_current.id = ai_current.classe_annuelle_id
          JOIN plans_tarifaires pt_current ON pt_current.annee_scolaire_id = i.annee_scolaire_id
            AND pt_current.site_id = i.site_id
            AND pt_current.classe_id = ca_current.classe_id
            AND pt_current.division_nom IS NOT DISTINCT FROM ca_current.division_nom
            AND pt_current.actif = true
          JOIN tranches_tarifaires tt_current ON tt_current.plan_tarifaire_id = pt_current.id
            AND tt_current.id = o.source_config_id
            AND tt_current.actif = true
          WHERE ai_current.inscription_id = i.id AND ai_current.active = true
        )
      LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
      LEFT JOIN paiements p ON p.id = ap.paiement_id
      WHERE e.id = $1
      GROUP BY e.id, i.id, ca.code_affichage, a.libelle, o.id
      ORDER BY o.ordre`, [studentId, ...siteFilter.params]);
    if (!result.rowCount) return null;
    const first = result.rows[0];
    return {
      student: { id: first.id, matricule: first.matricule, nom: first.nom, prenom: first.prenom, sexe: first.sexe, classe: first.classe, annee: first.annee },
      tranches: result.rows.filter((row) => row.obligation_id).map((row) => {
        const montantDu = Number(row.montant_du);
        const montantPaye = Number(row.montant_paye);
        const reste = Math.max(montantDu - montantPaye, 0);
        return { id: row.obligation_id, libelle: row.libelle, montantDu, montantPaye, reste, dateEcheance: row.date_echeance, statut: reste <= 0 ? 'solde' : montantPaye > 0 ? 'partiel' : 'impaye' };
      }),
    };
  }

  static async summary(scope, options = {}) {
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const levels = allowedLevelCodes(establishment.rows[0]?.type);
    const { sql: filterSql, params } = buildFilters(scope, options, 2);
    const result = await query(`${baseCte(filterSql)}
      SELECT statut, COUNT(*)::int AS total FROM computed GROUP BY statut`, [levels, ...params]);
    const out = { solde: 0, partiel: 0, impaye: 0 };
    for (const row of result.rows) out[row.statut] = row.total;
    return out;
  }

  static async list(scope, { search = '', classeAnnuelleId = null, statut = 'tous', page = 1, pageSize = 10 } = {}) {
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const levels = allowedLevelCodes(establishment.rows[0]?.type);
    const { sql: filterSql, params } = buildFilters(scope, { search, classeAnnuelleId }, 2);
    const statutFilter = ['solde', 'partiel', 'impaye'].includes(statut) ? ` WHERE statut = $${params.length + 2}` : '';
    const statutParams = statutFilter ? [statut] : [];
    const offset = (Math.max(1, page) - 1) * pageSize;

    const [rows, count] = await Promise.all([
      query(`${baseCte(filterSql)}
        SELECT * FROM computed${statutFilter}
        ORDER BY ordre, division_nom, nom, prenom
        LIMIT $${params.length + statutParams.length + 2} OFFSET $${params.length + statutParams.length + 3}`,
        [levels, ...params, ...statutParams, pageSize, offset]),
      query(`${baseCte(filterSql)}
        SELECT COUNT(*)::int AS total FROM computed${statutFilter}`,
        [levels, ...params, ...statutParams]),
    ]);

    return {
      students: rows.rows.map((row) => ({
        matricule: row.matricule, nom: row.nom, prenom: row.prenom, classe: row.code_affichage,
        totalDu: Number(row.total_du), totalPaye: Number(row.total_paye), reste: Number(row.reste), statut: row.statut, fraisImpayes: Number(row.frais_impayes),
      })),
      total: count.rows[0].total, page, pageSize,
    };
  }

  static async exportRows(scope, { search = '', classeAnnuelleId = null, statut = 'tous' } = {}) {
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const levels = allowedLevelCodes(establishment.rows[0]?.type);
    const { sql: filterSql, params } = buildFilters(scope, { search, classeAnnuelleId }, 2);
    const statutFilter = ['solde', 'partiel', 'impaye'].includes(statut) ? ` WHERE statut = $${params.length + 2}` : '';
    const statutParams = statutFilter ? [statut] : [];
    const result = await query(`${baseCte(filterSql)}
      SELECT * FROM computed${statutFilter}
      ORDER BY ordre, division_nom, nom, prenom`, [levels, ...params, ...statutParams]);
    return result.rows.map((row) => ({
      matricule: row.matricule, nom: row.nom, prenom: row.prenom, classe: row.code_affichage,
      totalDu: Number(row.total_du), totalPaye: Number(row.total_paye), reste: Number(row.reste), statut: row.statut, fraisImpayes: Number(row.frais_impayes),
    }));
  }
}
