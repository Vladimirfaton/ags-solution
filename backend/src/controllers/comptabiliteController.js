import { CashRegister } from '../models/CashRegister.js';
import { Enrollment } from '../models/Enrollment.js';
import { StudentRegistry } from '../models/StudentRegistry.js';
import { Payment } from '../models/Payment.js';
import { accessScopeFor } from '../models/AccessScope.js';
import { OverdueInstallments } from '../models/OverdueInstallments.js';
import ExcelJS from 'exceljs';

export const downloadStudentImportTemplate = async (_req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Élèves');
    sheet.columns = [
      { header: 'matricule', key: 'matricule', width: 22 }, { header: 'nom', key: 'nom', width: 24 }, { header: 'prenom', key: 'prenom', width: 24 },
      { header: 'sexe', key: 'sexe', width: 12 }, { header: 'date_naissance', key: 'date_naissance', width: 18 }, { header: 'lieu_naissance', key: 'lieu_naissance', width: 24 },
      { header: 'nationalite', key: 'nationalite', width: 18 }, { header: 'telephone', key: 'telephone', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modele_import_eleves.xlsx"');
    res.send(buffer);
  } catch (error) { next(error); }
};

export const getCashOverview = async (req, res, next) => {
 try { res.json(await CashRegister.overview(await accessScopeFor(req.user))); } catch (error) { next(error); }
  };
export const getEnrollmentOptions = async (req, res, next) => {
 try { res.json(await Enrollment.options(await accessScopeFor(req.user), req.query.siteId)); } catch (error) { next(error); }
};
export const getClassesForStudent = async (req, res, next) => {
  try { res.json({ classes: await Enrollment.classesForStudent(req.params.studentId, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const createEnrollment = async (req, res, next) => {
  try {
    const { studentId, annualClassId, type = 'reinscription' } = req.body;
    if (!annualClassId) return res.status(400).json({ error: 'La classe est requise.' });
    if (type === 'inscription') {
      const { matricule, nom, prenom } = req.body;
      if (!matricule || !nom || !prenom) return res.status(400).json({ error: 'Matricule, nom et prénom sont requis.' });
    return res.status(201).json({ student: await StudentRegistry.create(req.body, req.user.id, await accessScopeFor(req.user)) });
    }
    if (!studentId) return res.status(400).json({ error: 'Élève et classe sont requis.' });
    res.status(201).json({ inscription: await Enrollment.create(req.body, req.user.id, await accessScopeFor(req.user)) });
  } catch (error) { next(error); }
};
export const getPaymentOptions = async (req, res, next) => { try { res.json({ students: await Payment.options(await accessScopeFor(req.user)) }); } catch (error) { next(error); } };
export const createPayment = async (req, res, next) => {
  try {
   const result = await Payment.create(req.body, req.user.id, await accessScopeFor(req.user));
    res.status(201).json(result);
  } catch (error) { next(error); }
};
import { FinancialStatement } from '../models/FinancialStatement.js';

export const getPaymentStatus = async (req, res, next) => {
  try {
    const scope = await accessScopeFor(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const options = { search: req.query.recherche || '', classeAnnuelleId: req.query.classeId || null, statut: req.query.statut || 'tous', page, pageSize };
    const [list, summary] = await Promise.all([FinancialStatement.list(scope, options), FinancialStatement.summary(scope, options)]);
    res.json({ ...list, summary });
  } catch (error) { next(error); }
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportPaymentStatus = async (req, res, next) => {
  try {
    const scope = await accessScopeFor(req.user);
    const rows = await FinancialStatement.exportRows(scope, { search: req.query.recherche || '', classeAnnuelleId: req.query.classeId || null, statut: req.query.statut || 'tous' });
    const statutLabel = { solde: 'Soldé', partiel: 'Partiel', impaye: 'Impayé' };
    const header = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Montant dû', 'Montant payé', 'Reste', 'Statut', 'Frais généraux impayés'];
    const lines = [header.map(csvEscape).join(';')];
    for (const row of rows) {
      lines.push([row.matricule, row.nom, row.prenom, row.classe, row.totalDu, row.totalPaye, row.reste, statutLabel[row.statut], row.fraisImpayes > 0 ? 'Oui' : 'Non'].map(csvEscape).join(';'));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="statut-paiements.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) { next(error); }
};

export const getPaymentHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    res.json(await Payment.list(await accessScopeFor(req.user), { search: req.query.recherche || '', page, pageSize }));
  } catch (error) { next(error); }
};
export const getPaymentReceipt = async (req, res, next) => {
  try { res.json(await Payment.getReceiptData(req.params.id, await accessScopeFor(req.user))); } catch (error) { next(error); }
};
export const getOverdueInstallments = async (req, res, next) => {
  try { res.json(await OverdueInstallments.summary(await accessScopeFor(req.user), { search: req.query.recherche || '' })); }
  catch (error) { next(error); }
};
export const getOverdueInstallmentsByClass = async (req, res, next) => {
  try {
    const classe = String(req.query.classe || '').trim();
    if (!classe) return res.status(400).json({ error: 'La classe est requise.' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 5));
    res.json(await OverdueInstallments.pageForClass(await accessScopeFor(req.user), { classe, search: req.query.recherche || '', page, pageSize }));
  } catch (error) { next(error); }
};
export const exportOverdueInstallments = async (req, res, next) => {
  try {
    const classe = String(req.query.classe || '').trim();
    if (!classe) return res.status(400).json({ error: 'La classe est requise.' });
    const items = await OverdueInstallments.allForClass(await accessScopeFor(req.user), { classe });
    if (!items.length) return res.status(404).json({ error: 'Aucune échéance dépassée pour cette classe.' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Échéances dépassées');
    sheet.columns = [
      { header: 'Matricule', key: 'matricule', width: 18 },
      { header: 'Nom', key: 'nom', width: 24 },
      { header: 'Prénom', key: 'prenom', width: 24 },
      { header: 'Tranche', key: 'libelle', width: 24 },
      { header: 'Échéance', key: 'dateEcheance', width: 14 },
      { header: 'Montant dû', key: 'montantDu', width: 16 },
      { header: 'Montant payé', key: 'montantPaye', width: 16 },
      { header: 'Reste', key: 'reste', width: 16 },
      { header: 'Statut', key: 'statut', width: 12 },
    ];
    for (const item of items) {
      sheet.addRow({
        matricule: item.matricule,
        nom: item.nom,
        prenom: item.prenom,
        libelle: item.libelle,
        dateEcheance: new Date(item.dateEcheance).toLocaleDateString('fr-FR'),
        montantDu: Number(item.montantDu || 0),
        montantPaye: Number(item.montantPaye || 0),
        reste: Number(item.reste || 0),
        statut: item.statut === 'partiel' ? 'Partiel' : 'Impayé',
      });
    }
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    ['F', 'G', 'H'].forEach((column) => { sheet.getColumn(column).numFmt = '#,##0'; });

    const fileName = `echeances-depassees-${classe.replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) { next(error); }
};