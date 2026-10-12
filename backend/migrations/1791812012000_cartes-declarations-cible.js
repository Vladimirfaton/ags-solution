export const up = (pgm) => {
  pgm.sql(`ALTER TABLE cartes_declarations_perte
    ADD COLUMN IF NOT EXISTS classe_annuelle_id uuid REFERENCES classes_annuelles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS eleve_id uuid REFERENCES eleves(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS lu_par_admin boolean NOT NULL DEFAULT false,
    ALTER COLUMN date_perte DROP NOT NULL`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_cartes_declarations_perte_non_lues
    ON cartes_declarations_perte (created_at) WHERE lu_par_admin = false`);
  pgm.sql(`INSERT INTO cartes_brouillons
      (annee_scolaire_id, site_id, classe_annuelle_id, nom, total_cartes, statut, created_at, updated_at)
    SELECT n.annee_scolaire_id, n.site_id, ca.id,
      'Brouillon ' || ca.code_affichage || ' · ' || a.libelle,
      COUNT(DISTINCT i.eleve_id)::int, 'pret', n.sent_at, n.sent_at
    FROM cartes_notifications n
    JOIN annees_scolaires a ON a.id = n.annee_scolaire_id
    JOIN classes_annuelles ca ON ca.site_id = n.site_id
      AND ca.annee_scolaire_id = n.annee_scolaire_id AND ca.actif = true
      AND (n.classe_annuelle_id IS NULL OR n.classe_annuelle_id = ca.id)
    LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
    LEFT JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
    WHERE n.type = 'brouillon_pret'
      AND NOT EXISTS (
        SELECT 1 FROM cartes_brouillons d
        WHERE d.classe_annuelle_id = ca.id AND d.created_at = n.sent_at
      )
    GROUP BY n.annee_scolaire_id, n.site_id, ca.id, ca.code_affichage, a.libelle, n.sent_at`);
};

export const down = () => { throw new Error('La migration vers les déclarations de perte liées à une classe et un élève n’est pas réversible automatiquement.'); };
