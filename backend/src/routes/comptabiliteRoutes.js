import express from 'express';
import multer from 'multer';
import { createEnrollment, createPayment, exportPaymentStatus, getCashOverview, getClassesForStudent, getEnrollmentOptions, getOverdueInstallments, getPaymentHistory, getPaymentReceipt, getPaymentOptions, getPaymentStatus } from '../controllers/comptabiliteController.js';
import { getFinancialConfiguration, saveFinancialConfiguration } from '../controllers/directionController.js';
import { confirmStudentImport, previewStudentImport } from '../controllers/studentImportController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
const importUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024 },
	fileFilter: (_req, file, callback) => {
		const validMimeTypes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		];
		if (validMimeTypes.includes(file.mimetype)) return callback(null, true);
		callback(new Error('Seuls les fichiers Excel sont autorisés.'));
	},
});

router.use(authenticate);
router.get('/caisse', authorizePermission('caisse.gerer'), getCashOverview);
router.get('/inscriptions/options', authorizePermission('inscription.creer'), getEnrollmentOptions);
router.get('/inscriptions/eleve/:studentId/classes', authorizePermission('inscription.creer'), getClassesForStudent);
router.post('/inscriptions', authorizePermission('inscription.creer'), createEnrollment);
router.post('/imports/eleves/apercu', authorizePermission('inscription.creer'), importUpload.single('file'), previewStudentImport);
router.post('/imports/eleves/confirmer', authorizePermission('inscription.creer'), importUpload.single('file'), confirmStudentImport);
router.get('/paiements/options', authorizePermission('caisse.gerer'), getPaymentOptions);
router.post('/paiements', authorizePermission('caisse.gerer'), createPayment);
router.get('/finances', authorizePermission('frais.gerer'), getFinancialConfiguration);
router.put('/finances', authorizePermission('frais.gerer'), saveFinancialConfiguration);
router.get('/paiements/statut', authorizePermission('caisse.gerer'), getPaymentStatus);
router.get('/paiements/statut/export', authorizePermission('caisse.gerer'), exportPaymentStatus);
router.get('/paiements/historique', authorizePermission('caisse.gerer'), getPaymentHistory);
router.get('/paiements/:id/recu', authorizePermission('caisse.gerer'), getPaymentReceipt);
router.get('/paiements/echeances-depassees', authorizePermission('caisse.gerer'), getOverdueInstallments);
export default router;