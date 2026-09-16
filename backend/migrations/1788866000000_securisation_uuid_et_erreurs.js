/**
 * Les tables héritées du premier projet exigeaient parfois que le code fournisse
 * l'UUID. Cette protection au niveau PostgreSQL évite toute nouvelle omission.
 */
export const up = (pgm) => {
  ['users', 'etablissement', 'classes_legacy', 'eleves', 'brouillons_cartes', 'observations', 'notifications_brouillon', 'notifications_cartes']
    .forEach((table) => pgm.sql(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`));
};

export const down = () => { throw new Error('Sécurisation UUID non réversible.'); };
