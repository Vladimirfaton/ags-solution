export const up = (pgm) => {
  pgm.dropConstraint('paiements', 'paiement_mode');
  pgm.addConstraint('paiements', 'paiement_mode', "CHECK (mode_paiement IN ('especes', 'mobilemoney_banque'))");
};

export const down = (pgm) => {
  pgm.dropConstraint('paiements', 'paiement_mode');
  pgm.addConstraint('paiements', 'paiement_mode', "CHECK (mode_paiement IN ('especes', 'mobile_money', 'banque'))");
};
