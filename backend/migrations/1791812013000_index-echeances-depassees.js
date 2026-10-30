export const up = (pgm) => {
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_affectations_paiement_obligation
    ON affectations_paiement (obligation_financiere_id)`);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_obligations_tranches_echeance
    ON obligations_financieres (date_echeance, inscription_id)
    WHERE type = 'tranche_scolarite'`);
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_obligations_tranches_echeance');
  pgm.sql('DROP INDEX IF EXISTS idx_affectations_paiement_obligation');
};
