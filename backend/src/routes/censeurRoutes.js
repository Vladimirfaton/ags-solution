import express from 'express';
import {
	assignProfessor,
	createProfessor,
	createSubject,
	endProfessorAssignment,
	getOverview,
	listClassStudents,
	listClasses,
	listProfessorAssignments,
	listProfessors,
	listSubjects,
	updateProfessor,
	updateSubject,
} from '../controllers/censeurController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/apercu', authorizePermission('classe.consulter'), getOverview);
router.get('/classes', authorizePermission('classe.consulter'), listClasses);
router.get('/classes/:classId/eleves', authorizePermission('eleve.consulter'), listClassStudents);
router.get('/matieres', authorizePermission('professeur.consulter'), listSubjects);
router.post('/matieres', authorizePermission('professeur.gerer'), createSubject);
router.put('/matieres/:id', authorizePermission('professeur.gerer'), updateSubject);
router.get('/professeurs', authorizePermission('professeur.consulter'), listProfessors);
router.post('/professeurs', authorizePermission('professeur.gerer'), createProfessor);
router.put('/professeurs/:id', authorizePermission('professeur.gerer'), updateProfessor);
router.get('/professeurs/:id/affectations', authorizePermission('professeur.consulter'), listProfessorAssignments);
router.post('/professeurs/:id/affectations', authorizePermission('professeur.affecter_classes'), assignProfessor);
router.put('/affectations/:assignmentId/terminer', authorizePermission('professeur.affecter_classes'), endProfessorAssignment);
export default router;
