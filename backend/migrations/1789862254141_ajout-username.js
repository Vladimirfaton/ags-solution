export const up = (pgm) => {
  pgm.addColumns('users', {
    username_locked: { type: 'boolean', notNull: true, default: false },
  });
};
export const down = (pgm) => { throw new Error('Ne pas déverrouiller les identifiants automatiquement.'); };