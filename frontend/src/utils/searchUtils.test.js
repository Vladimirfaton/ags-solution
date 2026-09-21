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
});
