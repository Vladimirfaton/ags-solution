import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../../src/config/database.js';
import { CashRegister } from '../../src/models/CashRegister.js';
import { FinancialConfiguration } from '../../src/models/FinancialConfiguration.js';
import { Payment } from '../../src/models/Payment.js';
import { createSisFixture } from '../helpers/sisFixture.js';

describe('Payment', () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createSisFixture();
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('encaisse une partie d’une obligation et calcule le reste dû', async () => {
    const student = await fixture.createStudent();
    const inscription = await query(
      'SELECT id FROM inscriptions WHERE eleve_id = $1 AND site_id = $2',
      [student.id, fixture.siteId]
    );
    const obligation = await query(
      `SELECT id, montant_du
       FROM obligations_financieres
       WHERE inscription_id = $1`,
      [inscription.rows[0].id]
    );

    const result = await Payment.create(
      {
        inscriptionId: inscription.rows[0].id,
        allocations: [{ obligationId: obligation.rows[0].id, montant: 400 }],
        modePaiement: 'especes',
        montantRemis: 500,
      },
      fixture.userId,
      fixture.scope
    );

    const options = await Payment.options(fixture.scope);
    const paidStudent = options.find(
      (item) => item.inscriptionId === inscription.rows[0].id
    );
    const cash = await CashRegister.overview(fixture.scope);

    expect(result.payment.montant_encaisse).toBe('400.00');
    expect(result.payment.monnaie_rendue).toBe('100.00');
    expect(paidStudent.obligations[0]).toMatchObject({
      montantDu: 1000,
      montantPaye: 400,
      reste: 600,
    });
    expect(Number(cash.today.total)).toBe(400);
    expect(cash.today.operations).toBe(1);
  }, 15000);

  it('refuse un paiement supérieur au reste dû', async () => {
    const student = await fixture.createStudent();
    const inscription = await query(
      'SELECT id FROM inscriptions WHERE eleve_id = $1 AND site_id = $2',
      [student.id, fixture.siteId]
    );
    const obligation = await query(
      'SELECT id FROM obligations_financieres WHERE inscription_id = $1',
      [inscription.rows[0].id]
    );

    await expect(
      Payment.create(
        {
          inscriptionId: inscription.rows[0].id,
          allocations: [{ obligationId: obligation.rows[0].id, montant: 1001 }],
          modePaiement: 'mobilemoney_banque',
          montantRemis: 1001,
        },
        fixture.userId,
        fixture.scope
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('synchronise les tranches dans la caisse après la mise à jour du tarif', async () => {
    const student = await fixture.createStudent();
    await FinancialConfiguration.save({
      fees: [],
      tranches: [
        { nom: 'Tranche 1', dateEcheance: '2030-01-31', ordre: 1 },
        { nom: 'Tranche 2', dateEcheance: '2030-06-30', ordre: 2 },
      ],
      plans: [{
        classeAnnuelleId: fixture.sourceClassId,
        montantTotal: 1000,
        tranches: [
          { id: fixture.trancheId, montant: 400 },
          { montant: 600 },
        ],
      }],
    }, fixture.scope);

    const options = await Payment.options(fixture.scope);
    const inscription = await query('SELECT id FROM inscriptions WHERE eleve_id = $1', [student.id]);
    const updatedStudent = options.find((item) => item.inscriptionId === inscription.rows[0].id);

    expect(updatedStudent.obligations).toHaveLength(2);
    expect(updatedStudent.obligations.map((obligation) => obligation.montantDu)).toEqual([400, 600]);
    expect(updatedStudent.obligations.map((obligation) => obligation.dateEcheance)).toEqual([
      '2030-01-31',
      '2030-06-30',
    ]);
  }, 15000);

  it('empêche deux encaissements simultanés de dépasser le reste dû', async () => {
    // Ce test doit repartir d'une obligation unique de 1000. Le test précédent
    // modifie volontairement le même tarif en deux tranches (400 + 600).
    await FinancialConfiguration.save({
      fees: [],
      tranches: [{ nom: 'Tranche unique', dateEcheance: '2030-01-31', ordre: 1 }],
      plans: [{ classeAnnuelleId: fixture.sourceClassId, montantTotal: 1000, tranches: [{ id: fixture.trancheId, montant: 1000 }] }],
    }, fixture.scope);
    const student = await fixture.createStudent();
    const inscription = await query(
      'SELECT id FROM inscriptions WHERE eleve_id = $1 AND site_id = $2',
      [student.id, fixture.siteId]
    );
    const obligation = await query(
      'SELECT id FROM obligations_financieres WHERE inscription_id = $1',
      [inscription.rows[0].id]
    );

    const paymentData = {
      inscriptionId: inscription.rows[0].id,
      allocations: [{ obligationId: obligation.rows[0].id, montant: 600 }],
      modePaiement: 'mobilemoney_banque',
      montantRemis: 600,
    };

    const results = await Promise.allSettled([
      Payment.create(paymentData, fixture.userId, fixture.scope),
      Payment.create(paymentData, fixture.userId, fixture.scope),
    ]);

    const paid = await query(
      `SELECT COALESCE(SUM(ap.montant_affecte), 0) AS total
       FROM affectations_paiement ap
      JOIN paiements p ON p.id = ap.paiement_id
       WHERE ap.obligation_financiere_id = $1
         AND p.statut = 'confirme'`,
      [obligation.rows[0].id]
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(Number(paid.rows[0].total)).toBe(600);
  }, 15000);
 });
