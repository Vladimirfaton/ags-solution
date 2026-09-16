export class FinancialObligation {
  static async createForEnrollment(client, { inscriptionId, anneeScolaireId, siteId, typeInscription }) {
    const annualClass = await client.query(`SELECT ca.classe_id, ca.division_nom, ca.code_affichage
      FROM affectations_inscription ai
      JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
      WHERE ai.inscription_id = $1 AND ai.active = true`, [inscriptionId]);
    if (!annualClass.rowCount) throw Object.assign(new Error('Impossible de déterminer la classe de l’inscription.'), { status: 400, expose: true });

    const { classe_id: classeId, division_nom: divisionNom, code_affichage: classLabel } = annualClass.rows[0];
    const plan = await client.query(`SELECT id, montant_total
      FROM plans_tarifaires
      WHERE annee_scolaire_id = $1 AND site_id = $2 AND classe_id = $3
        AND division_nom IS NOT DISTINCT FROM $4 AND actif = true`, [anneeScolaireId, siteId, classeId, divisionNom]);
    if (!plan.rowCount) throw Object.assign(new Error(`Configurez le tarif de la classe ${classLabel} avant l’inscription.`), { status: 400, expose: true });

    const tranches = await client.query(`SELECT id, ordre, nom, montant, date_echeance
      FROM tranches_tarifaires
      WHERE plan_tarifaire_id = $1 AND actif = true ORDER BY ordre`, [plan.rows[0].id]);
    if (!tranches.rowCount) throw Object.assign(new Error(`Configurez les tranches du tarif de la classe ${classLabel} avant l’inscription.`), { status: 400, expose: true });

      const fees = await client.query(`SELECT id, ordre, nom, montant, obligatoire
      FROM frais_generaux_config
      WHERE annee_scolaire_id = $1 AND site_id = $2 AND actif = true
        AND (applicable_a = $3 OR applicable_a = 'les_deux')
      ORDER BY ordre, nom`, [anneeScolaireId, siteId, typeInscription]);

    const obligations = [];
    for (const fee of fees.rows) {
      obligations.push((await client.query(`INSERT INTO obligations_financieres
        (inscription_id, type, source_config_id, libelle, montant_du, obligatoire, ordre)
          VALUES ($1, 'frais_general', $2, $3, $4, $5, $6) RETURNING id, type, libelle, montant_du, obligatoire, date_echeance, ordre`,
      [inscriptionId, fee.id, fee.nom, fee.montant, fee.obligatoire, fee.ordre])).rows[0]);
    }
    for (const tranche of tranches.rows) {
      obligations.push((await client.query(`INSERT INTO obligations_financieres
        (inscription_id, type, source_config_id, libelle, montant_du, obligatoire, date_echeance, ordre)
          VALUES ($1, 'tranche_scolarite', $2, $3, $4, true, $5, $6) RETURNING id, type, libelle, montant_du, obligatoire, date_echeance, ordre`,
      [inscriptionId, tranche.id, `${classLabel} - ${tranche.nom}`, tranche.montant, tranche.date_echeance, 1000 + tranche.ordre])).rows[0]);
    }
    return obligations;
  }
}
