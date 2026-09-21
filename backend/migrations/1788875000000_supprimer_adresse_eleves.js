/** Le contact du parent/tuteur est désormais stocké dans telephone. */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE eleves DROP COLUMN IF EXISTS adresse;');
};

export const down = () => {
  throw new Error('La colonne eleves.adresse est obsolète et ne doit pas être recréée.');
};