import express from 'express';
import { getOverview, listClassStudents, listClasses } from '../controllers/censeurController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/apercu', authorizePermission('classe.consulter'), getOverview);
router.get('/classes', authorizePermission('classe.consulter'), listClasses);
router.get('/classes/:classId/eleves', authorizePermission('eleve.consulter'), listClassStudents);
export default router;
