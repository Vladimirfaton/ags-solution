export const up = (pgm) => {
  pgm.addColumn('classes_annuelles', {
    capacite: { type: 'integer', check: 'capacite IS NULL OR capacite >= 0' },
  });
};

export const down = (pgm) => pgm.dropColumn('classes_annuelles', 'capacite');
