import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const CHAMPS = `
  id, classe_id, matricule, nom, prenom, sexe,
  TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
  lieu_naissance, nationalite, telephone, photo_path,
  created_at, updated_at
`;

export class Student {
  static async create(classeId, data) {
    const {
      matricule, nom, prenom, sexe, date_naissance,
      lieu_naissance, nationalite, telephone, photo_path,
    } = data;

    const id = uuidv4();

    const result = await query(
      `INSERT INTO eleves (
        id, classe_id, matricule, nom, prenom, sexe, date_naissance,
        lieu_naissance, nationalite, telephone, photo_path, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       RETURNING id, classe_id, matricule, nom, prenom, sexe,
                 TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
                 lieu_naissance, nationalite, telephone, photo_path,
                 created_at, updated_at`,
      [
        id, classeId, matricule, nom, prenom, sexe, date_naissance || null,
        lieu_naissance || null, nationalite || null, telephone || null,
        photo_path || null,
      ]
    );

    return result.rows[0];
  }

  static async findByClass(classId) {
    const result = await query(
      `SELECT ${CHAMPS} FROM eleves WHERE classe_id = $1 ORDER BY nom ASC, prenom ASC`,
      [classId]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query(`SELECT ${CHAMPS} FROM eleves WHERE id = $1`, [id]);
    return result.rows[0];
  }

  static async findByMatricule(matricule) {
    const result = await query(`SELECT ${CHAMPS} FROM eleves WHERE matricule = $1`, [matricule]);
    return result.rows[0];
  }

  static async update(id, data) {
    const {
      nom, prenom, sexe, date_naissance,
      lieu_naissance, nationalite, telephone,
    } = data;

    const result = await query(
      `UPDATE eleves
       SET nom = $1, prenom = $2, sexe = $3, date_naissance = $4,
           lieu_naissance = $5, nationalite = $6, telephone = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, classe_id, matricule, nom, prenom, sexe,
                 TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
                 lieu_naissance, nationalite, telephone, photo_path,
                 created_at, updated_at`,
      [nom, prenom, sexe, date_naissance || null, lieu_naissance || null,
       nationalite || null, telephone || null, id]
    );

    return result.rows[0];
  }

  static async updatePhoto(id, photoPath) {
    const result = await query(
      `UPDATE eleves SET photo_path = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, classe_id, matricule, nom, prenom, sexe,
                 TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance,
                 lieu_naissance, nationalite, telephone, photo_path,
                 created_at, updated_at`,
      [photoPath, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM eleves WHERE id = $1', [id]);
  }

  static async findAllByCollege(collegeId) {
    const result = await query(
      `SELECT e.id, e.classe_id, e.matricule, e.nom, e.prenom, e.sexe,
              TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance,
              e.lieu_naissance, e.nationalite, e.telephone, e.photo_path,
              c.code AS classe_code
       FROM eleves e
       JOIN classes c ON e.classe_id = c.id
       WHERE c.college_id = $1
       ORDER BY c.niveau ASC, c.serie ASC, e.nom ASC`,
      [collegeId]
    );
    return result.rows;
  }
}