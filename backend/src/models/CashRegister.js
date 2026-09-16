import { query } from '../config/database.js';

export class CashRegister {
  static async overview(scope) {
   const siteFilter = scope.allSites ? { sql: '', params: [] } : {
     sql: ' AND i.site_id = ANY($1::uuid[])',
     params: [scope.siteIds],
   };
    const [today, byMode, recent, activeYear, enrolled] = await Promise.all([
     query(`SELECT COALESCE(SUM(p.montant_encaisse), 0) AS total, COUNT(*)::int AS operations FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id WHERE p.nature = 'encaissement' AND p.statut = 'confirme' AND p.created_at::date = CURRENT_DATE${siteFilter.sql}`, siteFilter.params),
     query(`SELECT p.mode_paiement, COALESCE(SUM(p.montant_encaisse), 0) AS total FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id WHERE p.nature = 'encaissement' AND p.statut = 'confirme' AND p.created_at::date = CURRENT_DATE${siteFilter.sql} GROUP BY p.mode_paiement ORDER BY p.mode_paiement`, siteFilter.params),
    query(`SELECT p.id, p.numero_recu, p.mode_paiement, p.montant_encaisse, p.monnaie_rendue, p.created_at, e.matricule, e.nom, e.prenom FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id JOIN eleves e ON e.id = i.eleve_id WHERE p.nature = 'encaissement' AND p.statut = 'confirme'${siteFilter.sql} ORDER BY p.created_at DESC LIMIT 20`, siteFilter.params),
      query("SELECT libelle FROM annees_scolaires WHERE statut = 'active'"),
     query(`SELECT COUNT(*)::int AS count FROM inscriptions i WHERE i.statut = 'active'${siteFilter.sql}`, siteFilter.params),
    ]);
    return { today: today.rows[0], byMode: byMode.rows, recent: recent.rows, activeYear: activeYear.rows[0] || null, enrolledStudents: enrolled.rows[0].count };
  }
}
