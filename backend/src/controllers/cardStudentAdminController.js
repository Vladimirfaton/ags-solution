import multer from 'multer';
import { CardService } from '../models/CardService.js';
import { uploadBuffer, deleteByPublicUrl } from '../utils/storage.js';

const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg'].includes(file.mimetype)),
}).single('photo');

export const studentPhotoUpload = (req, res, next) => upload(req, res, (error) => (
  error ? next(fail('Photo invalide : PNG ou JPEG, 5 Mo maximum.', 400)) : next()
));

export const updateStudentCard = async (req, res, next) => {
  try { res.json({ eleve: await CardService.updateStudentCard(req.params.studentId, req.body) }); } catch (error) { next(error); }
};

export const uploadStudentPhoto = async (req, res, next) => {
  try {
    if (!req.file) throw fail('Aucun fichier valide fourni (PNG ou JPEG, 5 Mo maximum).', 400);
    await CardService.assertStudentAccess(req.params.studentId);
    const url = await uploadBuffer('photos', req.file);
    const { previous } = await CardService.setStudentPhoto(req.params.studentId, url);
    if (previous) await deleteByPublicUrl(previous).catch(() => {});
    res.json({ photoPath: url });
  } catch (error) { next(error); }
};