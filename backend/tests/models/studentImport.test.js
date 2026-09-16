import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../../src/config/database.js';
import { StudentImport } from '../../src/models/StudentImport.js';
import { createSisFixture } from '../helpers/sisFixture.js';

const workbookBuffer = async (headers, row) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Élèves');
  worksheet.addRow(headers);
  worksheet.addRow(row);
  return workbook.xlsx.writeBuffer();
};

describe('StudentImport', () => {
  let fixture;
  let sourceClassLabel;

  beforeAll(async () => {
    fixture = await createSisFixture();
    const annualClass = await query(
      'SELECT code_affichage FROM classes_annuelles WHERE id = $1',
      [fixture.sourceClassId]
    );
    sourceClassLabel = annualClass.rows[0].code_affichage;
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('lit une colonne groupée date et lieu de naissance', async () => {
    const buffer = await workbookBuffer(
      [
        'Matricule',
        'Nom',
        'Prénom(s)',
        'Date et lieu de naissance',
        'Sexe',
        'Nationalité',
        'Contact parent',
        'Classe',
      ],
      [
        'IMPORT-001',
        'Doe',
        'Jane Marie',
        '12/03/2012 à Porto-Novo',
        'F',
        'Béninoise',
        '0197000000',
        sourceClassLabel,
      ]
    );

    const preview = await StudentImport.preview(
      buffer,
      fixture.scope,
      fixture.siteId
    );

    expect(preview.valid).toBe(true);
    expect(preview.rows[0]).toMatchObject({
      matricule: 'IMPORT-001',
      prenom: 'Jane Marie',
      date_naissance: '2012-03-12',
      lieu_naissance: 'Porto-Novo',
      adresse: '0197000000',
    });
  });

  it('refuse un matricule déjà présent dans le registre', async () => {
    const student = await fixture.createStudent();
    const buffer = await workbookBuffer(
      [
        'Matricule',
        'Nom',
        'Prénom(s)',
        'Date de naissance',
        'Lieu de naissance',
        'Sexe',
        'Nationalité',
        'Contact parent',
        'Classe',
      ],
      [
        student.matricule,
        'Doe',
        'Jane',
        '12/03/2012',
        'Cotonou',
        'F',
        'Béninoise',
        '0197000000',
        sourceClassLabel,
      ]
    );

    const preview = await StudentImport.preview(
      buffer,
      fixture.scope,
      fixture.siteId
    );

    expect(preview.valid).toBe(false);
    expect(preview.errors[0].messages.join(' ')).toContain(
      'Matricule déjà présent'
    );
  });

  it('importe en une transaction élève, inscription, affectation et obligations', async () => {
    const matricule = `IMPORT-${randomUUID().toUpperCase()}`;
    const buffer = await workbookBuffer(
      [
        'Matricule',
        'Nom',
        'Prénom(s)',
        'Date de naissance',
        'Lieu de naissance',
        'Sexe',
        'Nationalité',
        'Contact parent',
        'Classe',
      ],
      [
        matricule,
        'Doe',
        'John Paul',
        '12/03/2012',
        'Cotonou',
        'M',
        'Béninoise',
        '0197000001',
        sourceClassLabel,
      ]
    );

    const result = await StudentImport.import(
      buffer,
      fixture.userId,
      fixture.scope,
      fixture.siteId
    );
    const insertedMatricule = result.students[0].matricule;
    const imported = await query(
      `SELECT i.id AS inscription_id, ai.classe_annuelle_id,
        COUNT(o.id)::int AS obligations
       FROM eleves e
       JOIN inscriptions i ON i.eleve_id = e.id
       JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
       LEFT JOIN obligations_financieres o ON o.inscription_id = i.id
       WHERE e.matricule = $1
       GROUP BY i.id, ai.classe_annuelle_id`,
      [insertedMatricule]
    );

    expect(result.imported).toBe(1);
    expect(imported.rows[0]).toMatchObject({
      classe_annuelle_id: fixture.sourceClassId,
      obligations: 1,
    });
  }, 15000);
});