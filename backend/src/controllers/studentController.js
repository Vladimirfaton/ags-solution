import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import logger from '../config/logger.js';
import { uploadBuffer, deleteByPublicUrl } from '../utils/storage.js';

export const createStudent = async (req, res) => {
  try {
    const { classId } = req.params;
    const {
      matricule, nom, prenom, sexe, date_naissance,
      lieu_naissance, nationalite, telephone,
    } = req.body;

    if (!matricule || !nom || !prenom) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const existing = await Student.findByMatricule(matricule);
    if (existing) {
      return res.status(409).json({ error: 'Ce matricule existe déjà' });
    }

    const photoUrl = req.file ? await uploadBuffer('photos', req.file) : null;

    const student = await Student.create(classId, {
      matricule, nom, prenom, sexe, date_naissance,
      lieu_naissance, nationalite, telephone,
      photo_path: photoUrl,
    });

    logger.info(`Student created: ${student.id} - ${nom} ${prenom}`);
    res.status(201).json(student);
  } catch (error) {
    logger.error(`Error creating student: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de la création de l'élève" });
  }
};

export const getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const students = await Student.findByClass(classId);
    res.json({ classInfo: classData, students });
  } catch (error) {
    logger.error(`Error fetching students: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des élèves' });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }
    res.json(student);
  } catch (error) {
    logger.error(`Error fetching student: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de la récupération de l'élève" });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const updated = await Student.update(studentId, req.body);
    logger.info(`Student updated: ${studentId}`);
    res.json(updated);
  } catch (error) {
    logger.error(`Error updating student: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'élève" });
  }
};

export const updateStudentPhoto = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo fournie' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const newPhotoUrl = await uploadBuffer('photos', req.file);

    if (student.photo_path) {
      await deleteByPublicUrl(student.photo_path);
    }

    const updated = await Student.updatePhoto(studentId, newPhotoUrl);
    logger.info(`Photo updated for student: ${studentId}`);
    res.json(updated);
  } catch (error) {
    logger.error(`Error updating photo: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la photo' });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    if (student.photo_path) {
      await deleteByPublicUrl(student.photo_path);
    }

    await Student.delete(studentId);
    logger.info(`Student deleted: ${studentId}`);
    res.json({ message: 'Élève supprimé' });
  } catch (error) {
    logger.error(`Error deleting student: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de la suppression de l'élève" });
  }
};

export const getStudentsByCollege = async (req, res) => {
  try {
    const students = await Student.findAllByCollege(req.params.collegeId);
    res.json(students);
  } catch (error) {
    logger.error(`Error fetching students by college: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des élèves' });
  }
};