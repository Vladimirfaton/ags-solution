export const up = (pgm) => {
  pgm.createTable('cartes_observations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    classe_annuelle_id: { type: 'uuid', notNull: true, references: 'classes_annuelles(id)', onDelete: 'CASCADE' },
    eleve_id: { type: 'uuid', references: 'eleves(id)', onDelete: 'SET NULL' },
    auteur_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    auteur_role: { type: 'varchar(30)', notNull: true },
    contenu: { type: 'text', notNull: true },
    lu_par_admin: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('cartes_observations', 'cartes_observations_contenu_check', { check: 'char_length(btrim(contenu)) > 0' });
  pgm.createIndex('cartes_observations', ['classe_annuelle_id', 'created_at'], { name: 'idx_cartes_observations_classe' });
  pgm.createIndex('cartes_observations', 'created_at', { name: 'idx_cartes_observations_non_lues', where: 'lu_par_admin = false' });
  pgm.sql('ALTER TABLE cartes_observations ENABLE ROW LEVEL SECURITY');

  pgm.addColumn('cartes_notifications', {
    envoye_par: { type: 'uuid', references: 'admins(id)', onDelete: 'SET NULL' },
  });
  pgm.alterColumn('cartes_notifications', 'date_passage', { type: 'timestamptz', using: 'date_passage::timestamptz' });
  pgm.addConstraint('cartes_notifications', 'cartes_notifications_date_passage_requise', {
    check: "type <> 'cartes_pretes' OR date_passage IS NOT NULL",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('cartes_notifications', 'cartes_notifications_date_passage_requise');
  pgm.alterColumn('cartes_notifications', 'date_passage', { type: 'date', using: 'date_passage::date' });
  pgm.dropColumn('cartes_notifications', 'envoye_par');
  pgm.dropTable('cartes_observations');
};