/** L'installation AGS-Solution ne demande que le type et le nom. */
export const up = (pgm) => {
  pgm.alterColumn('etablissement', 'commune', { notNull: false });
  pgm.alterColumn('etablissement', 'departement', { notNull: false });
};

export const down = () => { throw new Error('Installation minimale non réversible.'); };
