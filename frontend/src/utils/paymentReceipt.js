import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const clean = (value) => String(value ?? '').replace(/[^\x20-\xFF]/g, '');
const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} F CFA`;

export const generatePaymentReceiptPDF = async ({ payment, student, allocations }) => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  page.drawText('RECU INTERNE', { x: 42, y: height - 62, size: 19, font: bold, color: rgb(0.04, 0.38, 0.28) });
  page.drawText('AGS-Solution', { x: width - 150, y: height - 58, size: 13, font: bold, color: rgb(0.25, 0.25, 0.25) });
  page.drawLine({ start: { x: 42, y: height - 78 }, end: { x: width - 42, y: height - 78 }, thickness: 1, color: rgb(0.04, 0.38, 0.28) });
  let y = height - 112;
  const line = (label, value) => { page.drawText(clean(`${label} :`), { x: 48, y, size: 10, font: bold }); page.drawText(clean(value), { x: 175, y, size: 10, font: regular }); y -= 20; };
  line('Numero', payment.numero_recu);
  line('Date', new Date(payment.created_at).toLocaleString('fr-FR'));
  line('Eleve', `${student.nom} ${student.prenom}`);
  line('Matricule', student.matricule);
  line('Classe', student.code_affichage);
  line('Moyen', payment.mode_paiement === 'especes' ? 'Especes' : 'Mobile Money / banque');
  if (payment.reference_paiement) line('Reference', payment.reference_paiement);
  y -= 10;
  page.drawText('DETAIL DU PAIEMENT', { x: 48, y, size: 11, font: bold, color: rgb(0.04, 0.38, 0.28) });
  y -= 24;
  page.drawText('Designation', { x: 48, y, size: 9, font: bold });
  page.drawText('Montant', { x: 440, y, size: 9, font: bold });
  y -= 18;
  for (const allocation of allocations) {
    page.drawText(clean(allocation.libelle), { x: 48, y, size: 9, font: regular, maxWidth: 360 });
    page.drawText(money(allocation.montant), { x: 400, y, size: 9, font: regular });
    y -= 18;
  }
  page.drawLine({ start: { x: 48, y: y + 7 }, end: { x: width - 48, y: y + 7 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
  y -= 12;
  line('Total encaisse', money(payment.montant_encaisse));
  if (payment.mode_paiement === 'especes') { line('Montant remis', money(payment.montant_remis)); line('Monnaie rendue', money(payment.monnaie_rendue)); }
  page.drawText('Trace interne - ne remplace pas le recu officiel de l\'etablissement.', { x: 48, y: 68, size: 8, font: regular, color: rgb(0.35, 0.35, 0.35) });
  page.drawText('Powered by AGS-Solution', { x: width - 175, y: 36, size: 8, font: regular, color: rgb(0.58, 0.58, 0.58), rotate: degrees(45) });
  const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `recu_${payment.numero_recu}.pdf`; link.click();
  URL.revokeObjectURL(url);
};
