import { CardObservation } from '../models/CardObservation.js';
import { CardNotification } from '../models/CardNotification.js';
import { accessScopeFor } from '../models/AccessScope.js';

const scopeOf = async (user) => (user.accountType === 'admin' ? null : accessScopeFor(user));

export const listCardObservations = async (req, res, next) => {
  try { res.json({ observations: await CardObservation.listByClass(req.params.classId, await scopeOf(req.user)) }); } catch (error) { next(error); }
};

export const createCardObservation = async (req, res, next) => {
  try {
    const observation = await CardObservation.create({
      classId: req.params.classId,
      studentId: req.body.eleveId,
      content: req.body.contenu,
      author: req.user,
      scope: await scopeOf(req.user),
    });
    res.status(201).json({ observation });
  } catch (error) { next(error); }
};

export const deleteCardObservation = async (req, res, next) => {
  try {
    await CardObservation.remove(req.params.observationId, req.user, await scopeOf(req.user));
    res.json({ deleted: true });
  } catch (error) { next(error); }
};

export const getUnreadCardObservations = async (_req, res, next) => {
  try { res.json({ count: await CardObservation.countUnread(), observations: await CardObservation.listUnread(20) }); } catch (error) { next(error); }
};

export const markCardObservationsRead = async (_req, res, next) => {
  try { res.json({ updated: await CardObservation.markAllRead() }); } catch (error) { next(error); }
};

export const sendCardNotification = async (req, res, next) => {
  try {
    res.json(await CardNotification.send({
      type: req.body.type,
      classId: req.body.classeAnnuelleId,
      siteId: req.body.siteId,
      datePassage: req.body.datePassage,
      adminId: req.user.id,
    }));
  } catch (error) { next(error); }
};

export const listCardNotifications = async (req, res, next) => {
  try { res.json({ notifications: await CardNotification.list(req.query.siteId || null) }); } catch (error) { next(error); }
};