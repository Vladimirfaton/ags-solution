import express from 'express';
import {
  createClass,
  createLevel,
  listClasses,
  listCycles,
  listLevels,
  listStudentsByClass,
  transferStudent,
  updateStudent,
} from '../controllers/secretariatController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/classes', authorizePermission('classe.consulter'), listClasses);
router.post('/classes', authorizePermission('classe.gerer'), createClass);
router.get('/classes/:classId/eleves', authorizePermission('eleve.consulter'), listStudentsByClass);
router.put('/eleves/:id', authorizePermission('eleve.modifier'), updateStudent);
router.post('/eleves/:id/transfert', authorizePermission('eleve.transferer'), transferStudent);
router.get('/cycles', authorizePermission('classe.consulter'), listCycles);
router.get('/niveaux', authorizePermission('classe.consulter'), listLevels);
router.post('/niveaux', authorizePermission('classe.gerer'), createLevel);
export default router;
