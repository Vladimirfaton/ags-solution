import { accessScopeFor } from '../models/AccessScope.js';
import { CardDraft } from '../models/CardDraft.js';
import { CardLostDeclaration } from '../models/CardLostDeclaration.js';
import { CardObservation } from '../models/CardObservation.js';
import { CardService } from '../models/CardService.js';

export const getCardManagementData = async (req, res, next) => {
  try {
    const scope = await accessScopeFor(req.user);
    const [drafts, observations, classes] = await Promise.all([
      CardDraft.list(scope),
      CardObservation.listForManagement(scope),
      CardService.listManagementClasses(scope),
    ]);
    res.json({ drafts, observations, classes });
  } catch (error) { next(error); }
};

export const getCardDraft = async (req, res, next) => {
  try {
    const draft = await CardDraft.findForManagement(req.params.draftId, await accessScopeFor(req.user));
    res.json(draft);
  } catch (error) { next(error); }
};

export const listCardLostDeclarations = async (req, res, next) => {
  try { res.json({ declarations: await CardLostDeclaration.list(await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};

export const createCardLostDeclaration = async (req, res, next) => {
  try {
    const declaration = await CardLostDeclaration.create(req.body, req.user, await accessScopeFor(req.user));
    res.status(201).json({ declaration });
  } catch (error) { next(error); }
};

export const listUnreadCardLostDeclarations = async (_req, res, next) => {
  try { res.json({ declarations: await CardLostDeclaration.listUnread() }); } catch (error) { next(error); }
};

export const markCardLostDeclarationsRead = async (_req, res, next) => {
  try { res.json({ updated: await CardLostDeclaration.markAllRead() }); } catch (error) { next(error); }
};
