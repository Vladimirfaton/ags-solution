/** Sépare l'autorisation FVS admin de l'adhésion de la direction par site. */
export const up = (pgm) => {
  pgm.addColumn('modules_plateforme', {
    admin_actif: { type: 'boolean', notNull: true, default: false },
  });
  pgm.sql("UPDATE modules_plateforme SET admin_actif = actif WHERE code = 'cartes'");

  pgm.createTable('services_cartes_sites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'CASCADE' },
    confirme_par: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'RESTRICT' },
    confirme_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('services_cartes_sites', 'services_cartes_sites_site_unique', { unique: ['site_id'] });
  pgm.createIndex('services_cartes_sites', 'site_id', { name: 'idx_services_cartes_sites_site' });
  pgm.sql('ALTER TABLE services_cartes_sites ENABLE ROW LEVEL SECURITY');
};

export const down = () => { throw new Error('Migration activation Cartes par sites non réversible automatiquement.'); };
