import { StudentImport } from '../models/StudentImport.js';
import { accessScopeFor } from '../models/AccessScope.js';

const requireFile = (req) => {
  if (!req.file?.buffer) {
    const error = Object.assign(new Error('Le fichier Excel est requis.'), {
      status: 400,
      expose: true,
    });
    throw error;
  }
};

export const previewStudentImport = async (req, res, next) => {
  try {
    requireFile(req);
    const preview = await StudentImport.preview(
      req.file.buffer,
      await accessScopeFor(req.user),
      req.body.siteId
    );
    res.json(preview);
  } catch (error) {
    next(error);
  }
};

export const confirmStudentImport = async (req, res, next) => {
  try {
    requireFile(req);
    const result = await StudentImport.import(
      req.file.buffer,
      req.user.id,
      await accessScopeFor(req.user),
      req.body.siteId
    );
    res.status(201).json(result);
  } catch (error) {
    if (error.details) {
      return res.status(error.status || 400).json({
        error: error.message,
        errors: error.details,
      });
    }
    next(error);
  }
};