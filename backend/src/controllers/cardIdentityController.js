import multer from 'multer';
import { CardService } from '../models/CardService.js';
import { uploadBuffer, deleteByPublicUrl } from '../utils/storage.js';

const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg'].includes(file.mimetype)),
}).single('signature');

export const signatureUpload = (req, res, next) => upload(req, res, (error) => (
  error ? next(fail('Signature invalide : PNG ou JPEG, 2 Mo maximum.', 400)) : next()
));

export const getIdentity = async (_req, res, next) => {
  try { res.json({ identite: await CardService.identity() }); } catch (error) { next(error); }
};

export const updateIdentity = async (req, res, next) => {
  try { res.json({ identite: await CardService.updateSlogan(req.body.slogan) }); } catch (error) { next(error); }
};

export const uploadSignature = async (req, res, next) => {
  try {
    if (!req.file) throw fail('Aucun fichier valide fourni (PNG ou JPEG, 2 Mo maximum).', 400);
    const url = await uploadBuffer('signatures', req.file);
    const { identity, previous } = await CardService.setSignature(url);
    if (previous) await deleteByPublicUrl(previous).catch(() => {});
    res.json({ identite: identity });
  } catch (error) { next(error); }
};