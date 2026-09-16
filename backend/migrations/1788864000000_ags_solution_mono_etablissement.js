/**
 * AGS-Solution — fondation mono-etablissement.
 *
 * Cette migration est volontairement écrite pour une base NEUVE : elle refuse
 * toute base contenant des données de l'ancien modèle multi-établissements.
 * Les migrations historiques sont conservées pour que node-pg-migrate puisse
 * reconstruire le schéma depuis zéro, puis cette migration le transforme vers
 * la cible AGS-Solution.
 */

export const shorthands = undefined;

const timestamp = { type: 'timestamp', notNull: true, default: (pgm) => pgm.func('CURRENT_TIMESTAMP') };
const uuid = { type: 'uuid', primaryKey: true, default: (pgm) => pgm.func('gen_random_uuid()') };

export const up = (pgm) => {
  // Ne jamais appliquer cette refonte sur l'ancienne base multi-établissements.
  pgm.sql(`
    DO $$
    BEGIN
      IF (SELECT COUNT(*) FROM colleges) > 0
         OR (SELECT COUNT(*) FROM eleves) > 0
         OR (SELECT COUNT(*) FROM users) > 0 THEN
        RAISE EXCEPTION
          'La migration AGS-Solution exige une base vierge. Créez une nouvelle base au lieu de migrer les données multi-établissements existantes.';
      END IF;
    END $$;
  `);

  // L'ancien modèle est conservé par les migrations historiques, puis renommé.
  pgm.dropTable('renouvellements_cles', { ifExists: true });
  pgm.dropTable('payments_kkiapay', { ifExists: true });
  pgm.dropTable('access_keys', { ifExists: true });

  pgm.renameTable('colleges', 'etablissement');
  pgm.addColumns('etablissement', {
    singleton: { type: 'boolean', notNull: true, default: true },
    type: { type: 'varchar(30)', notNull: true, default: 'college' },
    statut: { type: 'varchar(20)', notNull: true, default: 'actif' },
  });
  pgm.addConstraint('etablissement', 'uniq_etablissement_singleton', 'UNIQUE(singleton)');
  pgm.addConstraint('etablissement', 'check_etablissement_singleton', 'CHECK (singleton = true)');
  pgm.addConstraint('etablissement', 'check_type_etablissement', "CHECK (type IN ('primaire', 'college', 'lycee', 'mixte'))");
  pgm.addConstraint('etablissement', 'check_statut_etablissement', "CHECK (statut IN ('actif', 'suspendu'))");

  // Les anciennes tables de cartes restent en place pendant la transition, mais
  // leurs noms indiquent qu'elles ne sont pas le modèle SIS de référence.
  pgm.renameTable('classes', 'classes_legacy');
  pgm.renameColumn('eleves', 'classe_id', 'legacy_classe_id');
  pgm.alterColumn('eleves', 'legacy_classe_id', { notNull: false });

  const legacyTables = [
    'users',
    'classes_legacy',
    'brouillons_cartes',
    'notifications_brouillon',
    'notifications_cartes',
  ];
  legacyTables.forEach((table) => pgm.renameColumn(table, 'college_id', 'etablissement_id'));

  pgm.alterColumn('users', 'status', { default: 'active' });
  pgm.addColumns('users', {
    activation_token_hash: { type: 'varchar(255)' },
    activation_expires_at: { type: 'timestamp' },
    disabled_at: { type: 'timestamp' },
  });

  // Modules activables pour l'unique établissement installé.
  pgm.createTable('modules_plateforme', {
    code: { type: 'varchar(50)', primaryKey: true },
    libelle: { type: 'varchar(150)', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
    active_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('modules_plateforme', 'check_module_plateforme', "CHECK (code IN ('gestion_scolaire', 'cartes'))");
  pgm.sql("INSERT INTO modules_plateforme (code, libelle) VALUES ('gestion_scolaire', 'Gestion scolaire')");

  // Sites : même un établissement sans filiale aura un site principal.
  pgm.createTable('sites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nom: { type: 'varchar(255)', notNull: true },
    est_principal: { type: 'boolean', notNull: true, default: false },
    adresse: { type: 'text' },
    commune: { type: 'varchar(255)' },
    departement: { type: 'varchar(255)' },
    telephone: { type: 'varchar(30)' },
    email: { type: 'varchar(255)' },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.sql('CREATE UNIQUE INDEX uniq_site_principal ON sites (est_principal) WHERE est_principal = true');

  // Rôles professionnels et permissions réelles sont séparés.
  pgm.createTable('permissions', {
    code: { type: 'varchar(100)', primaryKey: true },
    module: { type: 'varchar(50)', notNull: true },
    libelle: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
  });

  pgm.createTable('profils_acces', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nom: { type: 'varchar(100)', notNull: true, unique: true },
    designation: { type: 'varchar(50)', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('profil_permissions', {
    profil_id: { type: 'uuid', notNull: true, references: 'profils_acces(id)', onDelete: 'CASCADE' },
    permission_code: { type: 'varchar(100)', notNull: true, references: 'permissions(code)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('profil_permissions', 'pk_profil_permissions', 'PRIMARY KEY(profil_id, permission_code)');

  pgm.createTable('acces_utilisateur_sites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    site_id: { type: 'uuid', references: 'sites(id)', onDelete: 'CASCADE' },
    designation: { type: 'varchar(50)', notNull: true },
    portee: { type: 'varchar(20)', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('acces_utilisateur_sites', 'check_portee_site', "CHECK ((portee = 'etablissement' AND site_id IS NULL) OR (portee = 'site' AND site_id IS NOT NULL))");
  pgm.addConstraint('acces_utilisateur_sites', 'check_designation', "CHECK (designation IN ('directeur', 'secretaire', 'comptable', 'censeur'))");
  pgm.createIndex('acces_utilisateur_sites', ['user_id', 'actif'], { name: 'idx_acces_utilisateur_actif' });
  pgm.createIndex('acces_utilisateur_sites', ['site_id', 'actif'], { name: 'idx_acces_site_actif' });

  pgm.createTable('acces_utilisateur_profils', {
    acces_id: { type: 'uuid', notNull: true, references: 'acces_utilisateur_sites(id)', onDelete: 'CASCADE' },
    profil_id: { type: 'uuid', notNull: true, references: 'profils_acces(id)', onDelete: 'RESTRICT' },
  });
  pgm.addConstraint('acces_utilisateur_profils', 'pk_acces_utilisateur_profils', 'PRIMARY KEY(acces_id, profil_id)');

  pgm.createTable('demandes_modification_acces', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    demandeur_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'RESTRICT' },
    acces_cible_id: { type: 'uuid', notNull: true, references: 'acces_utilisateur_sites(id)', onDelete: 'RESTRICT' },
    permission_code: { type: 'varchar(100)', notNull: true, references: 'permissions(code)', onDelete: 'RESTRICT' },
    action: { type: 'varchar(10)', notNull: true },
    motif: { type: 'text', notNull: true },
    statut: { type: 'varchar(20)', notNull: true, default: 'en_attente' },
    traite_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    processed_at: { type: 'timestamp' },
  });
  pgm.addConstraint('demandes_modification_acces', 'check_action_modification_acces', "CHECK (action IN ('ajout', 'retrait'))");
  pgm.addConstraint('demandes_modification_acces', 'check_statut_modification_acces', "CHECK (statut IN ('en_attente', 'approuvee', 'refusee', 'appliquee'))");

  // Sessions persistées : 1 session par compte de gestion, 2 par admin FVS.
  pgm.createTable('sessions_utilisateur', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    token_id: { type: 'uuid', notNull: true, unique: true },
    device_label: { type: 'varchar(255)' },
    last_activity_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    revoked_at: { type: 'timestamp' },
    revoke_reason: { type: 'varchar(100)' },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createIndex('sessions_utilisateur', ['user_id', 'revoked_at'], { name: 'idx_sessions_utilisateur_actives' });

  // Structure scolaire. Toute classe effectivement utilisée est annuelle et liée
  // à un site ; la classe de référence reste durable (6e, 5e, Terminale...).
  pgm.createTable('annees_scolaires', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    libelle: { type: 'varchar(20)', notNull: true, unique: true },
    date_debut: { type: 'date', notNull: true },
    date_fin: { type: 'date', notNull: true },
    statut: { type: 'varchar(20)', notNull: true, default: 'brouillon' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('annees_scolaires', 'check_statut_annee', "CHECK (statut IN ('brouillon', 'active', 'archivee'))");
  pgm.sql("CREATE UNIQUE INDEX uniq_annee_active ON annees_scolaires (statut) WHERE statut = 'active'");

  pgm.createTable('cycles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nom: { type: 'varchar(100)', notNull: true, unique: true },
    ordre: { type: 'integer', notNull: true },
    type_division: { type: 'varchar(20)', notNull: true, default: 'libre' },
    actif: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('cycles', 'check_type_division', "CHECK (type_division IN ('groupe', 'serie', 'libre'))");

  pgm.createTable('classes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cycle_id: { type: 'uuid', notNull: true, references: 'cycles(id)', onDelete: 'CASCADE' },
    nom: { type: 'varchar(100)', notNull: true },
    ordre: { type: 'integer', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('classes', 'uniq_classe_cycle', 'UNIQUE(cycle_id, nom)');

  pgm.createTable('classes_annuelles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'CASCADE' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'CASCADE' },
    classe_id: { type: 'uuid', notNull: true, references: 'classes(id)', onDelete: 'RESTRICT' },
    division_nom: { type: 'varchar(50)' },
    division_type: { type: 'varchar(20)' },
    code_affichage: { type: 'varchar(150)', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('classes_annuelles', 'uniq_classe_annuelle', 'UNIQUE(annee_scolaire_id, site_id, classe_id, division_nom)');
  pgm.createIndex('classes_annuelles', ['site_id', 'annee_scolaire_id'], { name: 'idx_classes_annuelles_site_annee' });

  // Fiche élève durable + inscription annuelle et mouvements sans suppression.
  pgm.createTable('inscriptions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    eleve_id: { type: 'uuid', notNull: true, references: 'eleves(id)', onDelete: 'RESTRICT' },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'RESTRICT' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'RESTRICT' },
    type_inscription: { type: 'varchar(20)', notNull: true },
    statut: { type: 'varchar(20)', notNull: true, default: 'active' },
    date_inscription: { type: 'date', notNull: true, default: pgm.func('CURRENT_DATE') },
    sortie_at: { type: 'date' },
    motif_sortie: { type: 'text' },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('inscriptions', 'uniq_inscription_eleve_annee', 'UNIQUE(eleve_id, annee_scolaire_id)');
  pgm.addConstraint('inscriptions', 'check_type_inscription', "CHECK (type_inscription IN ('inscription', 'reinscription'))");
  pgm.addConstraint('inscriptions', 'check_statut_inscription', "CHECK (statut IN ('active', 'terminee', 'transferee', 'renvoyee', 'abandonnee'))");
  pgm.createIndex('inscriptions', ['site_id', 'annee_scolaire_id', 'statut'], { name: 'idx_inscriptions_liste' });
  pgm.createIndex('inscriptions', 'eleve_id', { name: 'idx_inscriptions_eleve' });

  pgm.createTable('affectations_inscription', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    inscription_id: { type: 'uuid', notNull: true, references: 'inscriptions(id)', onDelete: 'CASCADE' },
    classe_annuelle_id: { type: 'uuid', notNull: true, references: 'classes_annuelles(id)', onDelete: 'RESTRICT' },
    date_debut: { type: 'date', notNull: true, default: pgm.func('CURRENT_DATE') },
    date_fin: { type: 'date' },
    motif: { type: 'varchar(50)', notNull: true, default: 'affectation_initiale' },
    active: { type: 'boolean', notNull: true, default: true },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.sql('CREATE UNIQUE INDEX uniq_affectation_active ON affectations_inscription (inscription_id) WHERE active = true');
  pgm.createIndex('affectations_inscription', ['classe_annuelle_id', 'active'], { name: 'idx_affectations_classe_active' });

  pgm.createTable('mouvements_inscription', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    inscription_id: { type: 'uuid', notNull: true, references: 'inscriptions(id)', onDelete: 'CASCADE' },
    type: { type: 'varchar(30)', notNull: true },
    date_effet: { type: 'date', notNull: true },
    motif: { type: 'text', notNull: true },
    etablissement_destination: { type: 'varchar(255)' },
    enregistre_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('mouvements_inscription', 'check_type_mouvement', "CHECK (type IN ('transfert_interne', 'transfert_externe', 'renvoi', 'abandon', 'retour'))");

  // Paramètres de frais et montant réellement dû par l'élève.
  pgm.createTable('frais_generaux_config', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'CASCADE' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'CASCADE' },
    nom: { type: 'varchar(150)', notNull: true },
    montant: { type: 'numeric(12,2)', notNull: true },
    applicable_a: { type: 'varchar(20)', notNull: true },
    ordre: { type: 'integer', notNull: true, default: 0 },
    actif: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('frais_generaux_config', 'frais_generaux_montant_positif', 'CHECK (montant >= 0)');
  pgm.addConstraint('frais_generaux_config', 'frais_generaux_applicable', "CHECK (applicable_a IN ('inscription', 'reinscription', 'les_deux'))");

  pgm.createTable('plans_tarifaires', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    annee_scolaire_id: { type: 'uuid', notNull: true, references: 'annees_scolaires(id)', onDelete: 'CASCADE' },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'CASCADE' },
    classe_id: { type: 'uuid', notNull: true, references: 'classes(id)', onDelete: 'RESTRICT' },
    division_nom: { type: 'varchar(50)' },
    montant_total: { type: 'numeric(12,2)', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('plans_tarifaires', 'plan_tarifaire_montant_positif', 'CHECK (montant_total > 0)');
  pgm.addConstraint('plans_tarifaires', 'uniq_plan_tarifaire', 'UNIQUE(annee_scolaire_id, site_id, classe_id, division_nom)');

  pgm.createTable('tranches_tarifaires', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    plan_tarifaire_id: { type: 'uuid', notNull: true, references: 'plans_tarifaires(id)', onDelete: 'CASCADE' },
    ordre: { type: 'integer', notNull: true },
    nom: { type: 'varchar(100)', notNull: true },
    montant: { type: 'numeric(12,2)', notNull: true },
    date_echeance: { type: 'date', notNull: true },
    actif: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('tranches_tarifaires', 'uniq_ordre_tranche', 'UNIQUE(plan_tarifaire_id, ordre)');
  pgm.addConstraint('tranches_tarifaires', 'tranche_montant_positif', 'CHECK (montant > 0)');

  pgm.createTable('obligations_financieres', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    inscription_id: { type: 'uuid', notNull: true, references: 'inscriptions(id)', onDelete: 'RESTRICT' },
    type: { type: 'varchar(30)', notNull: true },
    source_config_id: { type: 'uuid' },
    libelle: { type: 'varchar(255)', notNull: true },
    montant_du: { type: 'numeric(12,2)', notNull: true },
    obligatoire: { type: 'boolean', notNull: true, default: true },
    date_echeance: { type: 'date' },
    ordre: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('obligations_financieres', 'obligation_type', "CHECK (type IN ('frais_general', 'tranche_scolarite'))");
  pgm.addConstraint('obligations_financieres', 'obligation_montant_positif', 'CHECK (montant_du > 0)');
  pgm.createIndex('obligations_financieres', ['inscription_id', 'ordre'], { name: 'idx_obligations_inscription' });

  pgm.createTable('paiements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    inscription_id: { type: 'uuid', notNull: true, references: 'inscriptions(id)', onDelete: 'RESTRICT' },
    numero_recu: { type: 'varchar(100)', notNull: true, unique: true },
    nature: { type: 'varchar(20)', notNull: true, default: 'encaissement' },
    mode_paiement: { type: 'varchar(30)', notNull: true },
    montant_remis: { type: 'numeric(12,2)' },
    montant_encaisse: { type: 'numeric(12,2)', notNull: true },
    monnaie_rendue: { type: 'numeric(12,2)', notNull: true, default: 0 },
    reference_paiement: { type: 'varchar(255)' },
    recu_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    paiement_origine_id: { type: 'uuid', references: 'paiements(id)', onDelete: 'RESTRICT' },
    statut: { type: 'varchar(20)', notNull: true, default: 'confirme' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('paiements', 'paiement_nature', "CHECK (nature IN ('encaissement', 'correction'))");
  pgm.addConstraint('paiements', 'paiement_mode', "CHECK (mode_paiement IN ('especes', 'mobilemoney_banque'))");
  pgm.addConstraint('paiements', 'paiement_montant_positif', 'CHECK (montant_encaisse > 0)');
  pgm.addConstraint('paiements', 'paiement_monnaie_positive', 'CHECK (monnaie_rendue >= 0)');
  pgm.addConstraint('paiements', 'paiement_statut', "CHECK (statut IN ('confirme', 'annule', 'corrige'))");
  pgm.createIndex('paiements', ['inscription_id', 'created_at'], { name: 'idx_paiements_inscription' });
  pgm.createIndex('paiements', ['recu_par', 'created_at'], { name: 'idx_paiements_comptable_date' });

  pgm.createTable('affectations_paiement', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    paiement_id: { type: 'uuid', notNull: true, references: 'paiements(id)', onDelete: 'RESTRICT' },
    obligation_financiere_id: { type: 'uuid', notNull: true, references: 'obligations_financieres(id)', onDelete: 'RESTRICT' },
    montant_affecte: { type: 'numeric(12,2)', notNull: true },
  });
  pgm.addConstraint('affectations_paiement', 'uniq_affectation_paiement', 'UNIQUE(paiement_id, obligation_financiere_id)');
  pgm.addConstraint('affectations_paiement', 'affectation_montant_positif', 'CHECK (montant_affecte > 0)');

  pgm.createTable('demandes_correction_paiement', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    paiement_id: { type: 'uuid', notNull: true, references: 'paiements(id)', onDelete: 'RESTRICT' },
    demandeur_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    motif: { type: 'text', notNull: true },
    justificatif_path: { type: 'text' },
    statut: { type: 'varchar(20)', notNull: true, default: 'en_attente' },
    decision_par: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    decision_at: { type: 'timestamp' },
    commentaire_decision: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('demandes_correction_paiement', 'correction_paiement_statut', "CHECK (statut IN ('en_attente', 'approuvee', 'refusee', 'executee'))");
  pgm.createIndex('demandes_correction_paiement', ['statut', 'created_at'], { name: 'idx_corrections_en_attente' });

  // RLS bloque tout accès direct via la clé anon Supabase. L'API Express utilise
  // la connexion PostgreSQL de service et reste donc l'unique point d'accès.
  [
    'etablissement', 'modules_plateforme', 'sites', 'permissions', 'profils_acces',
    'profil_permissions', 'acces_utilisateur_sites', 'acces_utilisateur_profils',
    'demandes_modification_acces', 'sessions_utilisateur', 'annees_scolaires',
    'cycles', 'classes', 'classes_annuelles', 'inscriptions',
    'affectations_inscription', 'mouvements_inscription', 'frais_generaux_config',
    'plans_tarifaires', 'tranches_tarifaires', 'obligations_financieres',
    'paiements', 'affectations_paiement', 'demandes_correction_paiement',
  ].forEach((table) => pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
};

export const down = () => {
  throw new Error('La refonte AGS-Solution ne possède pas de rollback automatique. Restaurer une sauvegarde validée si nécessaire.');
};
