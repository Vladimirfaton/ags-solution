/**
 * Migration historique conservée pour préserver l'ordre node-pg-migrate.
 *
 * L'ancienne version réinitialisait les données avec TRUNCATE ... CASCADE et
 * ne doit plus jamais être exécutée. Le remodelage a été validé sur la base
 * historique ; cette entrée est désormais volontairement sans opération.
 */
export const up = (pgm) => {};
export const down = (pgm) => {};
