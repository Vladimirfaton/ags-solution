export const up = (pgm) => {
  pgm.createTable('matieres', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nom: { type: 'varchar(150)', notNull: true },
    code: { type: 'varchar(30)', unique: true },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.sql('CREATE UNIQUE INDEX uniq_matiere_nom_insensible_casse ON matieres (LOWER(nom));');

  pgm.createTable('professeurs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'RESTRICT' },
    nom: { type: 'varchar(150)', notNull: true },
    prenom: { type: 'varchar(150)', notNull: true },
    sexe: { type: 'varchar(1)' },
    telephone: { type: 'varchar(30)' },
    email: { type: 'varchar(255)' },
    actif: { type: 'boolean', notNull: true, default: true },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('professeurs', 'check_professeur_sexe', "CHECK (sexe IS NULL OR sexe IN ('M', 'F'))");
  pgm.createIndex('professeurs', ['site_id', 'actif'], { name: 'idx_professeurs_site_actif' });

  pgm.createTable('affectations_professeurs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    professeur_id: { type: 'uuid', notNull: true, references: 'professeurs(id)', onDelete: 'RESTRICT' },
    classe_annuelle_id: { type: 'uuid', notNull: true, references: 'classes_annuelles(id)', onDelete: 'RESTRICT' },
    matiere_id: { type: 'uuid', references: 'matieres(id)', onDelete: 'RESTRICT' },
    role: { type: 'varchar(20)', notNull: true },
    date_debut: { type: 'date', notNull: true, default: pgm.func('CURRENT_DATE') },
    date_fin: { type: 'date' },
    actif: { type: 'boolean', notNull: true, default: true },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint(
    'affectations_professeurs',
    'check_role_affectation_professeur',
    "CHECK (role IN ('enseignement', 'titulaire'))"
  );
  pgm.sql(`
    CREATE UNIQUE INDEX uniq_affectation_professeur_matiere_active
      ON affectations_professeurs (professeur_id, classe_annuelle_id, matiere_id)
      WHERE actif = true AND matiere_id IS NOT NULL;

    CREATE UNIQUE INDEX uniq_affectation_professeur_titulaire_active
      ON affectations_professeurs (professeur_id, classe_annuelle_id)
      WHERE actif = true AND matiere_id IS NULL;
  `);
  pgm.createIndex(
    'affectations_professeurs',
    ['classe_annuelle_id', 'actif'],
    { name: 'idx_affectations_professeurs_classe' }
  );

  ['matieres', 'professeurs', 'affectations_professeurs'].forEach((table) => {
    pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  });
};

export const down = () => {
  throw new Error('Les données pédagogiques ne doivent pas être supprimées automatiquement.');
};