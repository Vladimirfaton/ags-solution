/** Tables modernes du service Cartes, indépendantes de College/Class. */
export const up = (pgm) => {
  pgm.createTable('cartes_brouillons', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'RESTRICT' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'RESTRICT' },
    classe_annuelle_id: { type: 'uuid', notNull: true, references: 'classes_annuelles(id)', onDelete: 'RESTRICT' },
    nom: { type: 'varchar(150)', notNull: true },
    total_cartes: { type: 'integer', notNull: true, default: 0 },
    statut: { type: 'varchar(20)', notNull: true, default: 'brouillon' },
    cree_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('cartes_brouillons', 'cartes_brouillons_statut', "CHECK (statut IN ('brouillon', 'pret', 'archive'))");
  pgm.addConstraint('cartes_brouillons', 'cartes_brouillons_total_positif', 'CHECK (total_cartes >= 0)');
  pgm.createIndex('cartes_brouillons', ['site_id', 'annee_scolaire_id'], { name: 'idx_cartes_brouillons_site_annee' });

  pgm.createTable('cartes_notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    brouillon_id: { type: 'uuid', references: 'cartes_brouillons(id)', onDelete: 'SET NULL' },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'RESTRICT' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'RESTRICT' },
    classe_annuelle_id: { type: 'uuid', references: 'classes_annuelles(id)', onDelete: 'SET NULL' },
    type: { type: 'varchar(30)', notNull: true },
    date_passage: { type: 'date' },
    sent_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    emails_sent: { type: 'integer', notNull: true, default: 0 },
    sent_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('cartes_notifications', 'cartes_notifications_type', "CHECK (type IN ('brouillon_pret', 'cartes_pretes'))");
  pgm.createIndex('cartes_notifications', ['site_id', 'sent_at'], { name: 'idx_cartes_notifications_site_date' });
  ['cartes_brouillons', 'cartes_notifications'].forEach((table) => pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
};

export const down = () => { throw new Error('Migration Cartes moderne non réversible automatiquement.'); };
