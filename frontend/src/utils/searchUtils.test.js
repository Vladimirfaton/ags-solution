import { describe, expect, it } from 'vitest';
import { matchStudentSearch, matchClassSearch } from './searchUtils.js';

describe('search utils', () => {
  it('matches student across all searchable fields', () => {
    const student = {
      matricule: 'MAT-08',
      nom: 'EBENERERE',
      prenom: 'Adere',
      sexe: 'M',
      date_naissance: '2026-02-11',
      lieu_naissance: 'Cotonou',
      nationalite: 'BENINOISE',
      telephone: '0190786578',
    };

    expect(matchStudentSearch(student, '907')).toBe(true);
    expect(matchStudentSearch(student, 'cotonou adere')).toBe(true);
    expect(matchStudentSearch(student, 'nonexistent')).toBe(false);
  });

  it('matches class names across code and site labels', () => {
    const item = { code_affichage: '6E A', site_nom: 'Site central' };
    expect(matchClassSearch(item, 'central')).toBe(true);
    expect(matchClassSearch(item, '6e')).toBe(true);
    expect(matchClassSearch(item, 'abc')).toBe(false);
  });

  it('matches the technical level code even when the displayed class name differs', () => {
    const item = { code_affichage: 'Cours d’Initiation-A', niveau_code: 'CI' };
    expect(matchClassSearch(item, 'CI')).toBe(true);
  });

  it('matches every group when searching by the bare CI level code', () => {
    const classes = ['CI-A', 'CI-B', 'CI-C'].map((code_affichage) => ({ code_affichage }));
    expect(classes.filter((item) => matchClassSearch(item, 'CI'))).toEqual(classes);
  });

  it('matches the CI code from a legacy displayed class name without level metadata', () => {
    const item = { code_affichage: "Cours d'Initiation-A" };
    expect(matchClassSearch(item, 'CI')).toBe(true);
  });

  it('matches primary classes when searching for the establishment type', () => {
    expect(matchClassSearch({ code_affichage: 'CM1-A', niveau_code: 'CM1' }, 'primaire')).toBe(true);
    expect(matchClassSearch({ code_affichage: "Cours d'Initiation-A" }, 'primaire')).toBe(true);
    expect(matchClassSearch({ code_affichage: '6e-A', niveau_code: '6e' }, 'primaire')).toBe(false);
  });
});
