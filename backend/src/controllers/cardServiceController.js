import { CardService } from '../models/CardService.js';
import { accessScopeFor } from '../models/AccessScope.js';

export const getCardServiceStatus = async (_req, res, next) => {
  try { res.json(await CardService.status()); } catch (error) { next(error); }
};

export const setCardServiceStatus = async (req, res, next) => {
  try { res.json(await CardService.setEnabled(req.body.actif)); } catch (error) { next(error); }
};

export const previewCards = async (req, res, next) => {
  try {
    res.json(await CardService.preview(req.params.classId, await accessScopeFor(req.user)));
  } catch (error) { next(error); }
};

export const getCardServiceStats = async (req, res, next) => {
  try {
    res.json(await CardService.stats(await accessScopeFor(req.user)));
  } catch (error) { next(error); }
};
