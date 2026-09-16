import { pool, query } from '../config/database.js';
import { resolveScopedSite } from './AccessScope.js';

const toNumber = (value) => Number(value);
const normalizeMoney = (value) => Math.round(toNumber(value) * 100) / 100;

export class FinancialConfiguration {
 static async get(scope = { allSites: true, siteIds: [] }, requestedSiteId = null) {
     const [year, siteId] = await Promise.all([
      query("SELECT id, libelle FROM annees_scolaires WHERE statut = 'active'"),
       resolveScopedSite(scope, requestedSiteId),
    ]);
    if (!year.rowCount) return { year: null, site: null, fees: [], classes: [] };

    const yearId = year.rows[0].id;
   const [site, fees, classes, plans] = await Promise.all([
     query('SELECT id, nom FROM sites WHERE id = $1', [siteId]),
      query(`SELECT id, nom, montant, applicable_a, obligatoire, ordre, actif
             FROM frais_generaux_config
             WHERE annee_scolaire_id = $1 AND site_id = $2
             ORDER BY ordre, nom`, [yearId, siteId]),
      query(`SELECT ca.id, ca.classe_id, ca.division_nom, ca.code_affichage
             FROM classes_annuelles ca
             WHERE ca.annee_scolaire_id = $1 AND ca.site_id = $2 AND ca.actif = true
             ORDER BY ca.code_affichage`, [yearId, siteId]),
      query(`SELECT pt.id, pt.classe_id, pt.division_nom, pt.montant_total, pt.actif,
                    tt.id AS tranche_id, tt.ordre AS tranche_ordre, tt.nom AS tranche_nom,
                    tt.montant AS tranche_montant, tt.date_echeance, tt.actif AS tranche_actif
             FROM plans_tarifaires pt
             LEFT JOIN tranches_tarifaires tt ON tt.plan_tarifaire_id = pt.id
             WHERE pt.annee_scolaire_id = $1 AND pt.site_id = $2
             ORDER BY pt.classe_id, pt.division_nom NULLS FIRST, tt.ordre`, [yearId, siteId]),
    ]);

    const planMap = new Map();
    for (const row of plans.rows) {
      const key = `${row.classe_id}:${row.division_nom || ''}`;
      if (!planMap.has(key)) planMap.set(key, { id: row.id, classe_id: row.classe_id, division_nom: row.division_nom, montant_total: row.montant_total, actif: row.actif, tranches: [] });
      if (row.tranche_id) planMap.get(key).tranches.push({ id: row.tranche_id, ordre: row.tranche_ordre, nom: row.tranche_nom, montant: row.tranche_montant, date_echeance: row.date_echeance, actif: row.tranche_actif });
    }

    return {
      year: year.rows[0],
      site: site.rows[0],
      fees: fees.rows,
      classes: classes.rows.map((annualClass) => ({
        ...annualClass,
        plan: planMap.get(`${annualClass.classe_id}:${annualClass.division_nom || ''}`) || null,
      })),
    };
  }

  static async save({ fees = [], plans = [] }, scope, requestedSiteId = null) {
  const context = await this.get(scope, requestedSiteId);
    if (!context.year || !context.site) throw Object.assign(new Error('Configurez une année scolaire active et un site principal.'), { status: 400, expose: true });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const yearId = context.year.id;
      const siteId = context.site.id;
      const feeIds = [];

      for (const fee of fees) {
        const values = [fee.nom.trim(), normalizeMoney(fee.montant), fee.applicableA, Boolean(fee.obligatoire), Number(fee.ordre || 0), Boolean(fee.actif ?? true), yearId, siteId];
        if (fee.id) {
          const result = await client.query(`UPDATE frais_generaux_config
            SET nom = $1, montant = $2, applicable_a = $3, obligatoire = $4, ordre = $5, actif = $6
            WHERE id = $7 AND annee_scolaire_id = $8 AND site_id = $9 RETURNING id`, [...values.slice(0, 6), fee.id, yearId, siteId]);
          if (!result.rowCount) throw Object.assign(new Error('Frais général introuvable pour cette année.'), { status: 400, expose: true });
          feeIds.push(fee.id);
        } else {
          const result = await client.query(`INSERT INTO frais_generaux_config (nom, montant, applicable_a, obligatoire, ordre, actif, annee_scolaire_id, site_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, values);
          feeIds.push(result.rows[0].id);
        }
      }
      await client.query(`UPDATE frais_generaux_config SET actif = false WHERE annee_scolaire_id = $1 AND site_id = $2${feeIds.length ? ' AND id <> ALL($3::uuid[])' : ''}`, feeIds.length ? [yearId, siteId, feeIds] : [yearId, siteId]);

      const planIds = [];
      for (const plan of plans) {
        const classResult = await client.query(`SELECT id FROM classes_annuelles WHERE id = $1 AND annee_scolaire_id = $2 AND site_id = $3 AND actif = true`, [plan.classeAnnuelleId, yearId, siteId]);
        if (!classResult.rowCount) throw Object.assign(new Error('Classe annuelle invalide.'), { status: 400, expose: true });
        const classRow = await client.query('SELECT classe_id, division_nom FROM classes_annuelles WHERE id = $1', [plan.classeAnnuelleId]);
        const { classe_id: classeId, division_nom: divisionNom } = classRow.rows[0];
        let existing = await client.query(`SELECT id FROM plans_tarifaires WHERE annee_scolaire_id = $1 AND site_id = $2 AND classe_id = $3 AND division_nom IS NOT DISTINCT FROM $4`, [yearId, siteId, classeId, divisionNom]);
        let planId;
        if (existing.rowCount) {
          planId = existing.rows[0].id;
          await client.query('UPDATE plans_tarifaires SET montant_total = $1, actif = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [normalizeMoney(plan.montantTotal), Boolean(plan.actif ?? true), planId]);
        } else {
          const result = await client.query(`INSERT INTO plans_tarifaires (annee_scolaire_id, site_id, classe_id, division_nom, montant_total, actif)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [yearId, siteId, classeId, divisionNom, normalizeMoney(plan.montantTotal), Boolean(plan.actif ?? true)]);
          planId = result.rows[0].id;
        }
        planIds.push(planId);
        const trancheIds = [];
        for (const tranche of plan.tranches || []) {
          if (tranche.id) {
            const result = await client.query(`UPDATE tranches_tarifaires SET ordre = $1, nom = $2, montant = $3, date_echeance = $4, actif = $5 WHERE id = $6 AND plan_tarifaire_id = $7 RETURNING id`, [Number(tranche.ordre), tranche.nom.trim(), normalizeMoney(tranche.montant), tranche.dateEcheance, Boolean(tranche.actif ?? true), tranche.id, planId]);
            if (!result.rowCount) throw Object.assign(new Error('Tranche introuvable pour ce tarif.'), { status: 400, expose: true });
            trancheIds.push(tranche.id);
          } else {
            const result = await client.query(`INSERT INTO tranches_tarifaires (plan_tarifaire_id, ordre, nom, montant, date_echeance, actif) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [planId, Number(tranche.ordre), tranche.nom.trim(), normalizeMoney(tranche.montant), tranche.dateEcheance, Boolean(tranche.actif ?? true)]);
            trancheIds.push(result.rows[0].id);
          }
        }
        await client.query(`UPDATE tranches_tarifaires SET actif = false WHERE plan_tarifaire_id = $1${trancheIds.length ? ' AND id <> ALL($2::uuid[])' : ''}`, trancheIds.length ? [planId, trancheIds] : [planId]);
      }
      await client.query(`UPDATE plans_tarifaires SET actif = false WHERE annee_scolaire_id = $1 AND site_id = $2${planIds.length ? ' AND id <> ALL($3::uuid[])' : ''}`, planIds.length ? [yearId, siteId, planIds] : [yearId, siteId]);
      await client.query('COMMIT');
      return this.get(scope, requestedSiteId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
