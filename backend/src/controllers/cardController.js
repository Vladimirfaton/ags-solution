import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import { College } from '../models/College.js';
import logger from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';
import QRCode from 'qrcode';

// Simpler PDF generation (sans dépendances natives complexes)
export const generateBrouillonPreview = async (req, res) => {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const students = await Student.findByClass(classId);
    if (students.length === 0) {
      return res.status(400).json({ error: 'Aucun élève dans cette classe' });
    }

    // Retourner les données pour la génération côté frontend
    res.json({
      classData,
      students,
      totalCards: students.length,
      cardsPerPage: 6,
      format: 'A4 Landscape',
      dpi: 300,
      message: 'Brouillon prêt pour génération PDF côté frontend',
    });

    logger.info(`Brouillon preview généré pour classe: ${classId}`);
  } catch (error) {
    logger.error(`Error generating brouillon: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la génération du brouillon' });
  }
};

export const generateFinalCards = async (req, res) => {
  try {
    const { classId } = req.params;
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Aucun élève à générer' });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    // Préparer les données pour frontend (génération en client-side)
    const cardsData = await Promise.all(
      students.map(async (studentId) => {
        const student = await Student.findById(studentId);
        if (!student) return null;

        // Générer QR code (infos établissement)
        const qrData = {
          company: process.env.FVS_COMPANY_NAME || 'FVS',
          contact: process.env.FVS_CONTACT_EMAIL || 'contact@fvs.com',
          phone: process.env.FVS_PHONE || '+229 97 268 741',
          website: process.env.FVS_WEBSITE || 'fvs.com',
        };

        const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));

        return {
          id: student.id,
          matricule: student.matricule,
          nom: student.nom,
          prenom: student.prenom,
          date_naissance: student.date_naissance,
          sexe: student.sexe,
          lieu_naissance: student.lieu_naissance,
          nationalite: student.nationalite,
          telephone: student.telephone,
          photo_path: student.photo_path,
          qrCode,
        };
      })
    );

    const validCards = cardsData.filter((c) => c !== null);

    res.json({
      classData,
      cardsCount: validCards.length,
      cards: validCards,
      specs: {
        width: 1012,
        height: 638,
        dpi: 300,
        format: 'CMYK',
        dimensions_mm: '85.6 x 53.98 mm',
      },
      message: 'Données prêtes pour génération PDF côté frontend',
    });

    logger.info(`Cards finales générées pour classe: ${classId} (${validCards.length} cartes)`);
  } catch (error) {
    logger.error(`Error generating final cards: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la génération des cartes' });
  }
};

export const updateStudentInBrouillon = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { nom, prenom, date_naissance, sexe, lieu_naissance, nationalite, telephone } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const updatedStudent = await Student.update(studentId, {
      nom,
      prenom,
      date_naissance,
      sexe,
      lieu_naissance,
      nationalite,
      telephone,
    });

    logger.info(`Student updated in brouillon: ${studentId}`);
    res.json(updatedStudent);
  } catch (error) {
    logger.error(`Error updating student: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};

export const getCardStats = async (req, res) => {
  try {
    const { collegeId } = req.params;

    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({ error: 'Collège non trouvé' });
    }

    const allStudents = await Student.findAllByCollege(collegeId);
    const classes = await Class.findByCollege(collegeId);

    res.json({
      college: college.nom,
      totalStudents: allStudents.length,
      totalClasses: classes.length,
      cardsGenerated: allStudents.length, // Nombre de cartes possibles
    });
  } catch (error) {
    logger.error(`Error fetching card stats: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
  }
};
