export const up = (pgm) => {
  pgm.createTable('cartes_declarations_perte', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'RESTRICT' },
    matricule: { type: 'varchar(80)', notNull: true },
    nom_eleve: { type: 'varchar(150)', notNull: true },
    prenom_eleve: { type: 'varchar(150)', notNull: true },
    classe: { type: 'varchar(150)' },
    date_perte: { type: 'date', notNull: true },
    details: { type: 'text' },
    declare_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('cartes_declarations_perte', 'cartes_declarations_perte_identite_check', {
    check: "char_length(btrim(matricule)) > 0 AND char_length(btrim(nom_eleve)) > 0 AND char_length(btrim(prenom_eleve)) > 0",
  });
  pgm.createIndex('cartes_declarations_perte', ['site_id', 'created_at'], { name: 'idx_cartes_declarations_perte_site_date' });
  pgm.sql('ALTER TABLE cartes_declarations_perte ENABLE ROW LEVEL SECURITY');
};

export const down = () => { throw new Error('La suppression des déclarations de cartes perdues nécessite une migration dédiée.'); };
