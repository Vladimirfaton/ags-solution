import { randomUUID } from 'crypto';
import { query } from '../../src/config/database.js';
import { StudentRegistry } from '../../src/models/StudentRegistry.js';

const scope = { allSites: false, siteIds: [] };

export const createSisFixture = async () => {
  const token = randomUUID().slice(0, 8);
  const ids = {
    userId: randomUUID(),
    siteId: randomUUID(),
    cycleId: randomUUID(),
    classId: randomUUID(),
    sourceClassId: randomUUID(),
    destinationClassId: randomUUID(),
planId: randomUUID(),
    trancheId: randomUUID(),
    createdYearId: null,
  };

  let activeYear = await query(
    "SELECT id FROM annees_scolaires WHERE statut = 'active' LIMIT 1"
  );

  if (!activeYear.rowCount) {
    ids.createdYearId = randomUUID();
    await query(
      `INSERT INTO annees_scolaires
        (id, libelle, date_debut, date_fin, statut)
       VALUES ($1, $2, '2026-09-01', '2027-07-31', 'active')`,
     [ids.createdYearId, `TEST-${token}`]
   );
   activeYear = { rows: [{ id: ids.createdYearId }] };
 }

 ids.yearId = activeYear.rows[0].id;

  await query(
    `INSERT INTO users (id, email, role, status)
     VALUES ($1, $2, 'comptable', 'active')`,
    [ids.userId, `test-${token}@example.test`]
  );

  await query(
    `INSERT INTO sites (id, nom, actif)
    VALUES ($1, $2, true)`,
   [ids.siteId, `TEST-INT-${token}`]
 );

  await query(
    `INSERT INTO cycles (id, nom, ordre, type_division)
    VALUES ($1, $2, 9999, 'libre')`,
    [ids.cycleId, `TEST-INT-${token}`]
  );

 await query(
   `INSERT INTO classes (id, cycle_id, nom, ordre, niveau_code)
    VALUES ($1, $2, '6e', 10, '6e')`,
    [ids.classId, ids.cycleId]
 );

 const division = `T${token}`;

 await query(
   `INSERT INTO classes_annuelles
     (id, annee_scolaire_id, site_id, classe_id, division_nom, division_type, code_affichage)
    VALUES ($1, $2, $3, $4, $5, 'groupe', $6)`,
   [
     ids.sourceClassId,
     ids.yearId,
     ids.siteId,
     ids.classId,
     division,
     `6e — Groupe ${division}`,
   ]
);

 await query(
   `INSERT INTO classes_annuelles
     (id, annee_scolaire_id, site_id, classe_id, division_nom, division_type, code_affichage)
    VALUES ($1, $2, $3, $4, $5, 'groupe', $6)`,
    [
     ids.destinationClassId,
           ids.yearId,
    ids.siteId,
      ids.classId,
      `${division}B`,
      `6e — Groupe ${division}B`,
  ]
  );

  await query(
    `INSERT INTO plans_tarifaires
      (id, annee_scolaire_id, site_id, classe_id, division_nom, montant_total)
     VALUES ($1, $2, $3, $4, $5, 1000)`,
    [ids.planId, ids.yearId, ids.siteId, ids.classId, division]
  );

 await query(
   `INSERT INTO tranches_tarifaires
      (id, plan_tarifaire_id, ordre, nom, montant, date_echeance)
     VALUES ($1, $2, 1, 'Tranche de test', 1000, '2030-01-31')`,
    [ids.trancheId, ids.planId]
 );

  const fixtureScope = { ...scope, siteIds: [ids.siteId] };
  let studentNumber = 0;

 return {
   ...ids,
    scope: fixtureScope,
   async createStudent() {
      studentNumber += 1;
      return StudentRegistry.create(
        {         annualClassId: ids.sourceClassId,
          matricule: `TEST-${token}-${studentNumber}`,
          nom: 'Élève',
          prenom: `Test ${studentNumber}`,
          sexe: 'M',
       },
      ids.userId,
       fixtureScope
     );
   },
   async cleanup() {      await query(
        `DELETE FROM affectations_paiement
        WHERE paiement_id IN (
          SELECT p.id
           FROM paiements p
           JOIN inscriptions i ON i.id = p.inscription_id
           WHERE i.site_id = $1
        )`,
       [ids.siteId]
     );
      await query(
       `DELETE FROM paiements
        WHERE inscription_id IN (
          SELECT id FROM inscriptions WHERE site_id = $1
        )`,
       [ids.siteId]
     );
     await query(
       `DELETE FROM obligations_financieres
        WHERE inscription_id IN (
          SELECT id FROM inscriptions WHERE site_id = $1
        )`,
      [ids.siteId]
     );
    await query(
      `DELETE FROM mouvements_inscription
        WHERE inscription_id IN (
          SELECT id FROM inscriptions WHERE site_id = $1
        )`,
     [ids.siteId]
     );
     await query(
       `DELETE FROM affectations_inscription
       WHERE inscription_id IN (
           SELECT id FROM inscriptions WHERE site_id = $1
        )`,
       [ids.siteId]
     );
     await query('DELETE FROM inscriptions WHERE site_id = $1', [ids.siteId]);
     await query('DELETE FROM plans_tarifaires WHERE site_id = $1', [ids.siteId]);
     await query('DELETE FROM classes_annuelles WHERE site_id = $1', [ids.siteId]);
    await query('DELETE FROM classes WHERE id = $1', [ids.classId]);
    await query('DELETE FROM cycles WHERE id = $1', [ids.cycleId]);
     await query('DELETE FROM sites WHERE id = $1', [ids.siteId]);
    await query('DELETE FROM users WHERE id = $1', [ids.userId]);

   if (ids.createdYearId) {
        await query('DELETE FROM annees_scolaires WHERE id = $1', [ids.createdYearId]);
     }
   },
  };
};
