/** Corrige les bases où la colonne obligatoire n'a pas été créée par la migration initiale. */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE obligations_financieres ADD COLUMN IF NOT EXISTS obligatoire boolean NOT NULL DEFAULT true;');
};

export const down = () => { throw new Error('La colonne obligatoire ne doit pas être retirée automatiquement.'); };
