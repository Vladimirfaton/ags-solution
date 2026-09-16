import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../../src/config/database.js';
import { StudentRegistry } from '../../src/models/StudentRegistry.js';
import { createSisFixture } from '../helpers/sisFixture.js';

describe('StudentRegistry', () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createSisFixture();
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('refuse un matricule déjà présent dans le registre durable', async () => {
    const student = await fixture.createStudent();

    await expect(
      StudentRegistry.create(
        {
          annualClassId: fixture.sourceClassId,
          matricule: student.matricule,
          nom: 'Doublon',
          prenom: 'Test',
          sexe: 'F',
        },
        fixture.userId,
        fixture.scope
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('conserve l’élève et trace le transfert entre classes', async () => {
    const student = await fixture.createStudent();

    await StudentRegistry.transfer(
      student.id,
      fixture.destinationClassId,
      'Changement de classe',
      fixture.userId,
      fixture.scope
    );

    const [registry, assignments, movements] = await Promise.all([
      query('SELECT id FROM eleves WHERE id = $1', [student.id]),
      query(
        `SELECT classe_annuelle_id, active
         FROM affectations_inscription ai
         JOIN inscriptions i ON i.id = ai.inscription_id
         WHERE i.eleve_id = $1
         ORDER BY ai.created_at`,
        [student.id]
      ),
            query(
        `SELECT type, motif
         FROM mouvements_inscription mi
         JOIN inscriptions i ON i.id = mi.inscription_id
         WHERE i.eleve_id = $1`,
        [student.id]
      ),
    ]);
    expect(registry.rowCount).toBe(1);
    expect(assignments.rows).toHaveLength(2);
    expect(assignments.rows[0].active).toBe(false);
    expect(assignments.rows[1]).toMatchObject({
      classe_annuelle_id: fixture.destinationClassId,
      active: true,
    });
    expect(movements.rows).toContainEqual({ type: 'transfert_interne' , motif: 'Changement de classe'});
  });
it('sérialise deux transferts simultanés du même élève', async () => {
    const student = await fixture.createStudent();

   const results = await Promise.allSettled([
      StudentRegistry.transfer(
        student.id,
        fixture.destinationClassId,
        'Première demande de transfert.',
        fixture.userId,
        fixture.scope
      ),
      StudentRegistry.transfer(
        student.id,
        fixture.destinationClassId,
        'Seconde demande de transfert.',
        fixture.userId,
        fixture.scope
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  }, 15000);
 });