import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../../src/config/database.js';
import { Professor, Subject } from '../../src/models/Professor.js';
import { createSisFixture } from '../helpers/sisFixture.js';

describe('Professor', () => {
  let fixture;
  let professor;
  let subject;

  beforeAll(async () => {
    fixture = await createSisFixture();
  });

  afterAll(async () => {
    if (professor) await query('DELETE FROM affectations_professeurs WHERE professeur_id = $1', [professor.id]);
    if (subject) await query('DELETE FROM matieres WHERE id = $1', [subject.id]);
    if (professor) await query('DELETE FROM professeurs WHERE id = $1', [professor.id]);
    await fixture?.cleanup();
  });

  it('crée un professeur dans le site du censeur', async () => {
    professor = await Professor.create({
      siteId: fixture.siteId,
      nom: 'HOUNKPE',
      prenom: 'Alain',
      sexe: 'M',
      telephone: '0197000000',
    }, fixture.userId, fixture.scope);

    expect(professor).toMatchObject({
      site_id: fixture.siteId,
      nom: 'HOUNKPE',
      prenom: 'Alain',
      actif: true,
    });
  });

  it('affecte un professeur à une matière et une classe annuelle du collège', async () => {
    subject = await Subject.create({ nom: 'Mathématiques', code: 'MATH' });
    const assignment = await Professor.assign({
      professorId: professor.id,
      annualClassId: fixture.sourceClassId,
      matiereId: subject.id,
    }, fixture.userId, fixture.scope);

    expect(assignment).toMatchObject({
      professeur_id: professor.id,
      classe_annuelle_id: fixture.sourceClassId,
      matiere_id: subject.id,
      role: 'enseignement',
      actif: true,
    });
  });
});