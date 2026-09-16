/** Comptes de gestion créés directement lors de la mise en service. */
export const up = (pgm) => {
  pgm.alterColumn('users', 'email', { notNull: false });
  pgm.addColumns('users', {
    password_personalized: { type: 'boolean', notNull: true, default: false },
    password_reset_token_hash: { type: 'varchar(255)' },
    password_reset_expires_at: { type: 'timestamp' },
  });
};

export const down = () => { throw new Error('Migration comptes directs non réversible.'); };
