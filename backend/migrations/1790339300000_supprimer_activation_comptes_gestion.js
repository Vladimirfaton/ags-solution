/** Le flux d'activation email appartenait à l'ancien modèle College/Class. */
export const up = (pgm) => {
  pgm.dropColumns('users', ['activation_token_hash', 'activation_expires_at'], { ifExists: true });
};

export const down = () => {
  throw new Error('Migration destructive non réversible : le flux d’activation email est supprimé.');
};
