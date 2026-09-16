import { randomUUID } from 'crypto';
import { pool, query } from '../config/database.js';

const amount = (value) => Math.round(Number(value) * 100) / 100;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status, expose: true }); };

export class Payment {
  static async options(scope) {  const siteFilter = scope.allSites ? { sql: '', params: [] } : {
     sql: ' AND i.site_id = ANY($1::uuid[])',
     params: [scope.siteIds],
   };
    const result = await query(`SELECT i.id AS inscription_id, e.matricule, e.nom, e.prenom,
        ca.code_affichage,
        o.id AS obligation_id, o.type, o.libelle, o.montant_du, o.date_echeance,
        COALESCE(SUM(CASE WHEN p.statut = 'confirme' THEN ap.montant_affecte ELSE 0 END), 0) AS montant_paye, o.obligatoire
      FROM inscriptions i
      JOIN eleves e ON e.id = i.eleve_id
      JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
      JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
      JOIN obligations_financieres o ON o.inscription_id = i.id
      LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
      LEFT JOIN paiements p ON p.id = ap.paiement_id
      WHERE i.statut = 'active'${siteFilter.sql}
      GROUP BY i.id, e.id, ca.id, o.id
     ORDER BY e.nom, e.prenom, o.ordre`, siteFilter.params);
    const students = new Map();
    for (const row of result.rows) {
      if (!students.has(row.inscription_id)) students.set(row.inscription_id, { inscriptionId: row.inscription_id, matricule: row.matricule, nom: row.nom, prenom: row.prenom, classe: row.code_affichage, obligations: [] });
      const remaining = amount(Number(row.montant_du) - Number(row.montant_paye));
        students.get(row.inscription_id).obligations.push({ id: row.obligation_id, type: row.type, libelle: row.libelle, obligatoire: row.obligatoire, montantDu: Number(row.montant_du), montantPaye: Number(row.montant_paye), reste: Math.max(remaining, 0), dateEcheance: row.date_echeance });
    }
    return [...students.values()];
  }

  static async create({ inscriptionId, allocations, modePaiement, montantRemis, referencePaiement }, userId, scope) {
    if (!['especes', 'mobilemoney_banque'].includes(modePaiement)) fail('Le moyen de paiement est invalide.');
    if (!Array.isArray(allocations) || !allocations.length) fail('Sélectionnez au moins un frais ou une tranche.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
    const scopeFilter = scope.allSites ? '' : ' AND i.site_id = ANY($2::uuid[])';
      const inscription = await client.query(`SELECT i.id, i.eleve_id, i.statut, e.matricule, e.nom, e.prenom, ca.code_affichage
        FROM inscriptions i JOIN eleves e ON e.id = i.eleve_id
        JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
        JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
       WHERE i.id = $1 AND i.statut = 'active'${scopeFilter}
       FOR UPDATE OF i`, scope.allSites ? [inscriptionId] : [inscriptionId, scope.siteIds]);
      if (!inscription.rowCount) fail('Inscription active introuvable.');
// Toute opération sur les obligations de cette inscription est sérialisée.
    // Un second encaissement attend la fin du premier avant de recalculer le reste dû.
      await client.query(
        `SELECT id
         FROM obligations_financieres
         WHERE inscription_id = $1
         ORDER BY id
         FOR UPDATE`,
       [inscriptionId]
     );
      const ids = allocations.map((item) => item.obligationId);
      if (new Set(ids).size !== ids.length) fail('Une obligation ne peut apparaître qu’une seule fois dans le paiement.');
      const obligations = await client.query(`SELECT o.id, o.type, o.libelle, o.montant_du,
          COALESCE(SUM(CASE WHEN p.statut = 'confirme' THEN ap.montant_affecte ELSE 0 END), 0) AS montant_paye
        FROM obligations_financieres o
        LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
        LEFT JOIN paiements p ON p.id = ap.paiement_id
        WHERE o.inscription_id = $1 AND o.id = ANY($2::uuid[])
        GROUP BY o.id`, [inscriptionId, ids]);
      if (obligations.rowCount !== ids.length) fail('Une obligation sélectionnée est introuvable.');

      const selected = new Map(allocations.map((item) => [item.obligationId, amount(item.montant)]));
      if ([...selected.values()].some((value) => !Number.isFinite(value) || value <= 0)) fail('Chaque montant affecté doit être supérieur à zéro.');
      const allObligations = await client.query(`SELECT o.id, o.type, o.obligatoire, o.montant_du,
          COALESCE(SUM(CASE WHEN p.statut = 'confirme' THEN ap.montant_affecte ELSE 0 END), 0) AS montant_paye
        FROM obligations_financieres o
        LEFT JOIN affectations_paiement ap ON ap.obligation_financiere_id = o.id
        LEFT JOIN paiements p ON p.id = ap.paiement_id
        WHERE o.inscription_id = $1 GROUP BY o.id`, [inscriptionId]);
      const hasPreviousPayment = allObligations.rows.some((row) => Number(row.montant_paye) > 0);
      const generalFees = allObligations.rows.filter((row) => row.type === 'frais_general' && row.obligatoire);
      for (const obligation of obligations.rows) {
        const remaining = amount(Number(obligation.montant_du) - Number(obligation.montant_paye));
        if (selected.get(obligation.id) > remaining) fail(`Le montant affecté à « ${obligation.libelle} » dépasse le reste dû.`);
      }
      if (!hasPreviousPayment && generalFees.length) {
        for (const fee of generalFees) {
          const remaining = amount(Number(fee.montant_du) - Number(fee.montant_paye));
          if (!selected.has(fee.id) || selected.get(fee.id) !== remaining) fail('Le premier paiement doit solder les frais généraux obligatoires.');
        }
      }

      const total = amount([...selected.values()].reduce((sum, value) => sum + value, 0));
      const given = modePaiement === 'especes' ? amount(montantRemis ?? total) : total;
      if (!Number.isFinite(given) || given < total) fail('Le montant remis est inférieur au montant à payer.');
      if (modePaiement !== 'especes' && amount(montantRemis ?? total) !== total) fail('Le montant Mobile Money / banque doit correspondre au total payé.');
      const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const payment = await client.query(`INSERT INTO paiements
        (inscription_id, numero_recu, mode_paiement, montant_remis, montant_encaisse, monnaie_rendue, reference_paiement, recu_par)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, numero_recu, mode_paiement, montant_remis, montant_encaisse, monnaie_rendue, reference_paiement, created_at`,
      [inscriptionId, receiptNumber, modePaiement, given, total, amount(given - total), referencePaiement?.trim() || null, userId]);
      for (const [obligationId, allocated] of selected) await client.query('INSERT INTO affectations_paiement (paiement_id, obligation_financiere_id, montant_affecte) VALUES ($1,$2,$3)', [payment.rows[0].id, obligationId, allocated]);
      await client.query('COMMIT');
      return { payment: payment.rows[0], student: inscription.rows[0], allocations: obligations.rows.map((row) => ({ libelle: row.libelle, montant: selected.get(row.id) })) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
