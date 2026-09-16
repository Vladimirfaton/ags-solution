import { describe, expect, it } from 'vitest';
import { normalizeUsername } from '../../src/utils/username.js';

describe('normalizeUsername', () => {
  it('conserve le séparateur de l’identifiant personnalisé et retire les accents', () => {
    expect(normalizeUsername('Cens-Ffúnmilayo')).toBe('cens-ffunmilayo');
  });
});
