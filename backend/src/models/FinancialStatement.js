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
      GROUP BY o.inscription_id
    ) due ON due.inscription_id = i.id
    LEFT JOIN (
      SELECT o.inscription_id, SUM(ap.montant_affecte) AS total_paye
      FROM obligations_financieres o
      JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
      JOIN paiements p ON p.id = ap.paiement_id AND p.statut = 'confirme'
      WHERE o.type = 'tranche_scolarite'
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
