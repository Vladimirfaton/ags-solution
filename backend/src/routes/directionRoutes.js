import express from 'express';
import { activateSchoolYear, closeSchoolYear, createSchoolYear, getEstablishmentStudents, getFinancialConfiguration, getOverview, listClassStudents, listSchoolYears,listYearClasses,listArchivedClassStudents, saveFinancialConfiguration } from '../controllers/directionController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/apercu', authorizePermission('etablissement.consulter'), getOverview);
router.get('/classes/:classId/eleves', authorizePermission('eleve.consulter'), listClassStudents);
router.get('/annees-scolaires', authorizePermission('annee_scolaire.gerer'), listSchoolYears);
router.post('/annees-scolaires', authorizePermission('annee_scolaire.gerer'), createSchoolYear);
router.post('/annees-scolaires/:id/activer', authorizePermission('annee_scolaire.gerer'), activateSchoolYear);
router.post('/annees-scolaires/:id/cloturer', authorizePermission('annee_scolaire.gerer'), closeSchoolYear);
router.get('/annees-scolaires/:id/classes', authorizePermission('annee_scolaire.gerer'), listYearClasses);
router.get('/finances', authorizePermission('frais.gerer'), getFinancialConfiguration);
router.put('/finances', authorizePermission('frais.gerer'), saveFinancialConfiguration);
router.get('/eleves', authorizePermission('eleve.consulter'), getEstablishmentStudents);
router.get('/archives/classes/:classId/eleves', authorizePermission('annee_scolaire.gerer'), listArchivedClassStudents);
export default router;
