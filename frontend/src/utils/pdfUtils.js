import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { FILE_BASE_URL } from '../services/api';

// ============================================================================
// CONSTANTES
// ============================================================================

const MM = 2.834645669; // 1 mm en points PDF

export const DEFAULT_CARD_MM = { width: 85.6, height: 53.98 };

const BASE_W = 242.6;  // largeur de référence du design (ISO ID-1 en pt)
const BASE_H = 153.07;

const GREEN = rgb(0.0, 0.53, 0.29);
const YELLOW = rgb(0.99, 0.85, 0.0);
const RED = rgb(0.89, 0.11, 0.14);
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.85, 0.85, 0.85);

export const getSchoolYear = (date = new Date()) => {
  const y = date.getFullYear();
  return date.getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

// ============================================================================
// RESSOURCES (photos, logo, signature, QR)
// ============================================================================

// Depuis la migration vers Supabase Storage, photo_path/signature_path contiennent
// deja l'URL publique complete -> on l'utilise telle quelle. Les anciens enregistrements
// (avant migration) contiennent encore un chemin local -> on reconstruit l'URL /uploads/...
// comme avant, pour rester compatible avec les donnees existantes.
const resolveFileUrl = (value, folder) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${FILE_BASE_URL}/uploads/${folder}/${value.split(/[\\/]/).pop()}`;
};

const photoFileUrl = (photoPath) => resolveFileUrl(photoPath, 'photos');

const signatureFileUrl = (signaturePath) => resolveFileUrl(signaturePath, 'signatures');

const embedFromUrl = async (pdfDoc, url) => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  } catch {
    return null;
  }
};

const embedStudentPhoto = (pdfDoc, photoPath) => embedFromUrl(pdfDoc, photoFileUrl(photoPath));
const embedSignature = (pdfDoc, signaturePath) => embedFromUrl(pdfDoc, signatureFileUrl(signaturePath));
const embedLogo = (pdfDoc) => embedFromUrl(pdfDoc, '/logo.png');

// Le QR pointe vers la page publique servie par le backend (verso commun a tout un
// college) : GET /api/colleges/:id/carte-info — affiche logo/infos + filigrane FVS,
// sans authentification, consultable par quiconque scanne une carte perdue/retrouvee.
// FILE_BASE_URL = VITE_API_URL sans le suffixe /api (voir services/api.js). En local,
// VITE_API_URL doit pointer vers l'IP reseau du PC (pas "localhost") pour etre
// joignable depuis un telephone.
export const buildQrPayload = (collegeInfo) => {
  if (!collegeInfo?.id) return `${FILE_BASE_URL}/api/colleges`;
  return `${FILE_BASE_URL}/api/colleges/${collegeInfo.id}/carte-info`;
};

const embedQr = async (pdfDoc, text) => {
  try {
    const dataUrl = await QRCode.toDataURL(text, { margin: 0, width: 400, errorCorrectionLevel: 'M' });
    return await pdfDoc.embedPng(dataUrl);
  } catch {
    return null;
  }
};

const fitContain = (imgW, imgH, boxW, boxH) => {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  return { w: imgW * scale, h: imgH * scale };
};

const loadHtmlImage = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// ============================================================================
// HELPERS TEXTE
// ============================================================================

// pdf-lib / Helvetica = WinAnsi : on neutralise les caracteres non encodables
const sanitize = (v) =>
  (v ?? '')
    .toString()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\xFF]/g, '');

const truncateText = (font, text, size, maxWidth) => {
  const str = sanitize(text);
  if (!str) return '';
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let cut = str;
  while (cut.length > 1 && font.widthOfTextAtSize(cut + '...', size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + '...';
};

export const wrapText = (font, text, size, maxWidth, maxLines = 2) => {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  let idx = 0;

  while (idx < words.length && lines.length < maxLines) {
    const word = words[idx];
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !current) {
      current = test;
      idx++;
    } else {
      lines.push(current);
      current = '';
    }
  }
  if (current) lines.push(current);

  // Mots restants non places -> tronquer la derniere ligne avec "..."
  if (idx < words.length && lines.length > 0) {
    const remaining = words.slice(idx).join(' ');
    const lastWithRemaining = `${lines[lines.length - 1]} ${remaining}`;
    lines[lines.length - 1] = truncateText(font, lastWithRemaining, size, maxWidth);
  }

  return lines;
};
// Reduit la taille de police jusqu'à ce que le texte tienne sur `maxLines` lignes
// sans troncature (au lieu de tronquer a taille fixe)
  const fitWrappedText = (font, text, maxWidth, maxLines, maxSize, minSize) => {
  let size = maxSize;
  while (size > minSize) {
    const lines = wrapText(font, text, size, maxWidth, maxLines);
    if (!lines.some((l) => l.endsWith('...'))) return { lines, size };
    size -= 0.5;
  }
  return { lines: wrapText(font, text, minSize, maxWidth, maxLines), size: minSize };
};
const drawCentered = (page, text, font, size, boxX, boxW, y, color = BLACK) => {
  const str = truncateText(font, text, size, boxW);
  if (!str) return;
  const w = font.widthOfTextAtSize(str, size);
  page.drawText(str, { x: boxX + (boxW - w) / 2, y, size, font, color });
};

// Calcule la plus grande taille de police faisant tenir `text` sur une ligne, en visant
// une largeur cible (ex: 70% de la carte), plafonnee par [minSize, maxSize] et par une
// largeur de securite (maxWidth) a ne jamais depasser. Si meme au corps minimal le texte
// deborde de maxWidth, on repasse la main a l'appelant pour un passage sur 2 lignes.
// measureFn(text, size) doit retourner la largeur du texte a la taille donnee.
export const fitTitleSize = (measureFn, text, targetWidth, maxWidth, minSize, maxSize) => {
  const unit = measureFn(text, 1) || 1;
  let size = targetWidth / unit;
  size = Math.min(maxSize, Math.max(minSize, size));
  while (size > minSize && measureFn(text, size) > maxWidth) size -= 0.4;
  const fits = measureFn(text, size) <= maxWidth;
  return { size, fits };
};

const drawTricolor = (page, x, y, w, h) => {
  const seg = w / 3;
  page.drawRectangle({ x, y, width: seg, height: h, color: GREEN });
  page.drawRectangle({ x: x + seg, y, width: seg, height: h, color: YELLOW });
  page.drawRectangle({ x: x + seg * 2, y, width: seg, height: h, color: RED });
};
const drawEnvelope = (page, x, y, w, h, color = BLACK) => {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 0.6 });
  page.drawLine({ start: { x, y: y + h }, end: { x: x + w / 2, y: y + h * 0.35 }, thickness: 0.6, color });
  page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w / 2, y: y + h * 0.35 }, thickness: 0.6, color });
};
const formatSexe = (s) => {
  const v = (s || '').toString().trim().toUpperCase();
  if (v === 'F' || v.startsWith('FEM')) return 'Féminin';
  if (v === 'M' || v.startsWith('MAS')) return 'Masculin';
  return s || '';
};

// L'API renvoie la date au format YYYY-MM-DD (TO_CHAR cote backend) -> affichage jj/mm/aaaa sur les cartes
const formatDateFr = (value) => {
  if (!value) return '';
  const str = value.toString().trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return str;
};

// ============================================================================
// RECTO
// ============================================================================

const drawRecto = (page, ox, oy, W, H, ctx) => {
  const { student, classInfo, collegeInfo, logo, photo, font, bold, italic, year } = ctx;
  const s = W / BASE_W;
  const u = (n) => n * s;
  const top = oy + H;
  const P = u(5);

  page.drawRectangle({
    x: ox, y: oy, width: W, height: H,
    color: rgb(1, 1, 1), borderColor: LIGHT, borderWidth: 0.5,
  });

  // ---- En-tete : logo ministere + bloc etablissement
  const logoW = u(130);
  const logoH = logo ? logoW * (logo.height / logo.width) : u(27);
  if (logo) {
    page.drawImage(logo, { x: ox + P, y: top - P - logoH, width: logoW, height: logoH });
  }
  const cbX = ox + P + logoW + u(4);
  const cbW = W - (cbX - ox) - P;

  // ---- Repartition de la hauteur du logo entre nom / slogan / adresse : le nom
  // recoit naturellement la plus grande part, slogan/adresse se partagent le reste.
  // Le bloc entier ne doit jamais depasser logoH, pour que le titre garde une
  // position fixe quelle que soit la longueur du nom de l'etablissement.
  const nomText = (collegeInfo?.nom || '').toUpperCase();
  const hasSlogan = !!collegeInfo?.slogan;
  const adresseLigne = [collegeInfo?.adresse_postale, collegeInfo?.commune].filter(Boolean).join('   ');
  const hasAddr = !!(collegeInfo?.adresse_postale || collegeInfo?.commune);

  const NAME_MAX = u(7);
  const NAME_MIN = u(5);
  const SMALL_MAX = u(5.5);
  const SMALL_MIN = u(4);

  let nameLinesCount = 1;
  let totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
  let rowH = logoH / totalRows;
  let nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
  const fitsOneLine = bold.widthOfTextAtSize(nomText, nameSize) <= cbW;

  let nameLines;
  if (fitsOneLine) {
    nameLines = [nomText];
  } else {
    nameLinesCount = 2;
    totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
    rowH = logoH / totalRows;
    nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
    nameLines = wrapText(bold, nomText, nameSize, cbW, 2);
  }
  const sloganSize = hasSlogan ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;
  const addrSize = hasAddr ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;

  let cy = top - P - nameSize * 0.85;
  nameLines.forEach((line) => {
    drawCentered(page, line, bold, nameSize, cbX, cbW, cy);
    cy -= nameSize * 1.15;
  });
  if (hasSlogan) {
    drawCentered(page, collegeInfo.slogan, italic, sloganSize, cbX, cbW, cy);
    cy -= sloganSize * 1.15;
  }
  if (hasAddr) {
    if (collegeInfo?.adresse_postale) {
      const iconH = addrSize * 0.85;
      const iconW = iconH * 1.4;
      const gap = addrSize * 0.45;
      const textW = font.widthOfTextAtSize(adresseLigne, addrSize);
      const blockW = iconW + gap + textW;
      const blockX = cbX + (cbW - blockW) / 2;
      drawEnvelope(page, blockX, cy - iconH * 0.15, iconW, iconH, BLACK);
      page.drawText(adresseLigne, { x: blockX + iconW + gap, y: cy, size: addrSize, font, color: BLACK });
    } else {
      drawCentered(page, collegeInfo.commune, font, addrSize, cbX, cbW, cy);
    }
  }

  // ---- Titre : position fixe, le bloc etablissement est contraint pour toujours
  // tenir dans la hauteur du logo
  const titleY = top - P - logoH - u(11);
  drawCentered(page, `CARTE D'IDENTITE SCOLAIRE   ${year}`, bold, u(10), ox, W, titleY);
  // ---- Lignes d'information (calculees avant la photo pour la dimensionner dessus)
  const labelSize = u(8);
  const valueSize = u(8);
  const lineH = u(12); // taille 8 x interligne 1.5
  const rows = [
    ['Nom :', student?.nom || ''],
    ['Prénom(s) :', student?.prenom || ''],
    ['Né(e) le :', `${formatDateFr(student?.date_naissance)}${student?.lieu_naissance ? `   à   ${student.lieu_naissance}` : ''}`],
    ['Sexe :', formatSexe(student?.sexe)],
    ['Nationalité :', student?.nationalite || ''],
    ['Adresse :', student?.adresse || ''],
    ['Classe :', classInfo?.code || ''],
  ];

  // ---- Photo + matricule (hauteur alignee exactement sur le bloc d'informations)
   // ---- Photo + matricule (hauteur alignee precisement sur le bloc d'informations,
  // en tenant compte de l'ascendante/descendante du texte, pas juste du nombre de lignes)
  const photoX = ox + u(8);
  const rowsFirstBaseline = titleY - u(10);
  const ASCENT = 0.74;
  const DESCENT = 0.22;
  const rowsTop = rowsFirstBaseline + labelSize * ASCENT;
  const rowsBottom = rowsFirstBaseline - (rows.length - 1) * lineH - labelSize * DESCENT;
  const photoH = rowsTop - rowsBottom;
  const photoW = photoH * (35 / 45); // conserve le ratio portrait d'origine
  const photoY = rowsBottom;

  page.drawRectangle({
    x: photoX, y: photoY, width: photoW, height: photoH,
    color: rgb(0.08, 0.08, 0.08),
  });
  if (photo) {
    const { w, h } = fitContain(photo.width, photo.height, photoW, photoH);
    page.drawImage(photo, {
      x: photoX + (photoW - w) / 2,
      y: photoY + (photoH - h) / 2,
      width: w, height: h,
    });
  }
  drawCentered(page, `Mle : ${student?.matricule || ''}`, bold, u(7), photoX, photoW, photoY - u(9));

  // ---- Colonne d'informations
  const infoX = photoX + photoW + u(9);
  const infoW = W - (infoX - ox) - P;

  let ry = titleY - u(10);
  rows.forEach(([label, value]) => {
    const lw = font.widthOfTextAtSize(label, labelSize);
    page.drawText(label, { x: infoX, y: ry, size: labelSize, font, color: BLACK });
    page.drawLine({
      start: { x: infoX, y: ry - u(1.6) },
      end: { x: infoX + lw, y: ry - u(1.6) },
      thickness: 0.4, color: BLACK,
    });
    const vx = infoX + lw + u(6);
    page.drawText(truncateText(bold, value, valueSize, infoW - (vx - infoX)), {
      x: vx, y: ry, size: valueSize, font: bold, color: BLACK,
    });
    ry -= lineH;
  });

  // ---- Bande tricolore centree sur toute la largeur de la carte
  const bandW = u(85);
  drawTricolor(page, ox + (W - bandW) / 2, oy + u(8), bandW, u(4.5));

  // ---- Cadre signature de l'apprenant (legerement reduit pour ne jamais chevaucher la bande)
  const sigW = u(58);
  const sigH = u(19);
  const sigX = ox + W - P - sigW;
  const sigY = oy + u(15);
  page.drawRectangle({
    x: sigX, y: sigY, width: sigW, height: sigH,
    borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.5,
  });
  drawCentered(page, "Signature de l'apprenant", italic, u(4.2), sigX, sigW, oy + u(9), GREY);
};

// ============================================================================
// VERSO (identique pour toutes les cartes d'un etablissement)
// ============================================================================

const drawVerso = (page, ox, oy, W, H, ctx) => {
  const { collegeInfo, qr, signature, font, bold, italic, year } = ctx;
  const s = W / BASE_W;
  const u = (n) => n * s;
  const top = oy + H;
  const P = u(6);

  page.drawRectangle({
    x: ox, y: oy, width: W, height: H,
    color: rgb(1, 1, 1), borderColor: LIGHT, borderWidth: 0.5,
  });

  // ---- Bloc central : nom de l'etablissement en tres grande police (~70% de la largeur,
  // la plus grande police de la carte), puis tel et titre en dessous
  const nameText = sanitize((collegeInfo?.nom || '').toUpperCase());
  const NAME_MIN = u(8);
  const NAME_MAX = u(15);
  const nameMaxWidth = W - P * 2;
  const fit = fitTitleSize(
    (t, sz) => bold.widthOfTextAtSize(t, sz),
    nameText, W * 0.7, nameMaxWidth, NAME_MIN, NAME_MAX
  );

  // Marge visuelle constante au-dessus du nom, quelle que soit la taille de police retenue
  // (avant : offset fixe -> le texte remontait visuellement quand la police grandissait)
  const TOP_MARGIN = u(9);
  const ASCENT = 0.74; // approx. hauteur des majuscules au-dessus de la ligne de base (Helvetica Bold)
  let cy = top - TOP_MARGIN - fit.size * ASCENT;
  const nameLines = fit.fits ? [nameText] : wrapText(bold, nameText, fit.size, nameMaxWidth, 2);
  nameLines.forEach((line) => {
    drawCentered(page, line, bold, fit.size, ox, W, cy, BLACK);
    cy -= fit.size * 1.25;
  });
  cy -= u(3);

  if (collegeInfo?.telephone) {
    drawCentered(page, `TEL : ${collegeInfo.telephone}`, font, u(6.5), ox, W, cy, BLACK);
    cy -= u(11);
  }

  drawCentered(page, `CARTE D'IDENTITE SCOLAIRE : ${year}`, bold, u(6.5), ox, W, cy, BLACK);
  cy -= u(16);

  // ---- Colonne directeur (moitie droite) : label, zone de signature vierge, nom souligne
  const rightX = ox + W * 0.42;
  const rightW = W * 0.58 - P;

  drawCentered(page, 'LE DIRECTEUR', bold, u(6), rightX, rightW, cy, BLACK);

  const sigBoxW = u(72);
  const sigBoxH = u(24);
  const sigX = rightX + (rightW - sigBoxW) / 2;
  const sigAreaTop = cy - u(9);
  const sigY = sigAreaTop - sigBoxH;

  if (signature) {
    const { w, h } = fitContain(signature.width, signature.height, sigBoxW, sigBoxH);
    page.drawImage(signature, {
      x: sigX + (sigBoxW - w) / 2,
      y: sigY + (sigBoxH - h) / 2,
      width: w, height: h,
    });
  }
  // sinon : zone laissee vierge pour une signature manuscrite

  const nameY = sigY - u(8);
  const directorName = sanitize(`${collegeInfo?.directeur_prenom || ''} ${collegeInfo?.directeur_nom || ''}`.trim());
  if (directorName) {
    const dirSize = u(6.5);
    const dirW = bold.widthOfTextAtSize(directorName, dirSize);
    const nameCenterX = sigX + sigBoxW / 2;
    page.drawText(directorName, {
      x: nameCenterX - dirW / 2, y: nameY, size: dirSize, font: bold, color: BLACK,
    });
    page.drawLine({
      start: { x: nameCenterX - dirW / 2, y: nameY - u(2) },
      end: { x: nameCenterX + dirW / 2, y: nameY - u(2) },
      thickness: 0.5, color: BLACK,
    });
  }

  // ---- Bande tricolore centree sur toute la largeur de la carte
  const bandW = u(85);
  drawTricolor(page, ox + (W - bandW) / 2, oy + u(8), bandW, u(4.5));

  // ---- QR code (gauche, reduit) — contient les coordonnees de l'etablissement + mention FVS
  const qrSize = u(28);
  const qrX = ox + u(14);
  const qrY = oy + (H - qrSize) / 2 - u(6);
  if (qr) {
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  } else {
    page.drawRectangle({
      x: qrX, y: qrY, width: qrSize, height: qrSize,
      borderColor: BLACK, borderWidth: 0.5,
    });
  }
};

// ============================================================================
// CONSTRUCTION DU PDF DES CARTES FINALES
// ============================================================================

const A4 = { width: 595.28, height: 841.89 };
const COLS = 2;
const ROWS = 4;

/**
 * options = {
 *   cardWidthMm, cardHeightMm,   // dimensions de la carte
 *   layout: 'a4' | 'pvc',        // 'a4' = 8 cartes/page, 'pvc' = 1 carte par page
 *   includeVerso: bool,
 *   cropMarks: bool              // reperes de decoupe (layout a4)
 * }
 */
export const buildFinalCardsPdfBytes = async (students, classInfo, collegeInfo, options = {}) => {
  const {
    cardWidthMm = DEFAULT_CARD_MM.width,
    cardHeightMm = DEFAULT_CARD_MM.height,
    layout = 'a4',
    includeVerso = true,
    cropMarks = true,
  } = options;

  const CW = cardWidthMm * MM;
  const CH = cardHeightMm * MM;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const year = getSchoolYear();
  const logo = await embedLogo(pdfDoc);
  const qr = await embedQr(pdfDoc, buildQrPayload(collegeInfo));
  const signature = await embedSignature(pdfDoc, collegeInfo?.signature_path);

  const photos = [];
  for (const st of students) {
    photos.push(await embedStudentPhoto(pdfDoc, st.photo_path));
  }

  const versoCtx = { collegeInfo, qr, signature, font, bold, italic, year };

  // ---------- Mode PVC : une carte par page, format = taille de la carte
  if (layout === 'pvc') {
    students.forEach((student, i) => {
      const recto = pdfDoc.addPage([CW, CH]);
      drawRecto(recto, 0, 0, CW, CH, {
        student, classInfo, collegeInfo, logo, photo: photos[i], font, bold, italic, year,
      });
      if (includeVerso) {
        const verso = pdfDoc.addPage([CW, CH]);
        drawVerso(verso, 0, 0, CW, CH, versoCtx);
      }
    });
    return pdfDoc.save();
  }

  // ---------- Mode A4 : 8 cartes par page (2 colonnes x 4 lignes)
  const perPage = COLS * ROWS;
  const gapX = 14;
  const gapY = 12;
  const gridW = COLS * CW + (COLS - 1) * gapX;
  const gridH = ROWS * CH + (ROWS - 1) * gapY;
  const startX = (A4.width - gridW) / 2;
  const startY = A4.height - (A4.height - gridH) / 2;

  const slotPos = (index) => {
    const r = Math.floor(index / COLS);
    const c = index % COLS;
    return {
      x: startX + c * (CW + gapX),
      y: startY - (r + 1) * CH - r * gapY,
    };
  };

  const drawCropMarks = (page, x, y) => {
    if (!cropMarks) return;
    const m = 5;
    const t = 0.3;
    const col = rgb(0.7, 0.7, 0.7);
    const seg = [
      [{ x: x - m, y }, { x: x - 1, y }],
      [{ x, y: y - m }, { x, y: y - 1 }],
      [{ x: x + CW + 1, y }, { x: x + CW + m, y }],
      [{ x: x + CW, y: y - m }, { x: x + CW, y: y - 1 }],
      [{ x: x - m, y: y + CH }, { x: x - 1, y: y + CH }],
      [{ x, y: y + CH + 1 }, { x, y: y + CH + m }],
      [{ x: x + CW + 1, y: y + CH }, { x: x + CW + m, y: y + CH }],
      [{ x: x + CW, y: y + CH + 1 }, { x: x + CW, y: y + CH + m }],
    ];
    seg.forEach(([a, b]) => page.drawLine({ start: a, end: b, thickness: t, color: col }));
  };

  for (let p = 0; p * perPage < students.length; p++) {
    const slice = students.slice(p * perPage, (p + 1) * perPage);

    const rectoPage = pdfDoc.addPage([A4.width, A4.height]);
    slice.forEach((student, i) => {
      const { x, y } = slotPos(i);
      drawRecto(rectoPage, x, y, CW, CH, {
        student, classInfo, collegeInfo, logo,
        photo: photos[p * perPage + i], font, bold, italic, year,
      });
      drawCropMarks(rectoPage, x, y);
    });

    if (includeVerso) {
      const versoPage = pdfDoc.addPage([A4.width, A4.height]);
      slice.forEach((_, i) => {
        // miroir horizontal pour l'impression recto/verso bord long
        const r = Math.floor(i / COLS);
        const c = COLS - 1 - (i % COLS);
        const x = startX + c * (CW + gapX);
        const y = startY - (r + 1) * CH - r * gapY;
        drawVerso(versoPage, x, y, CW, CH, versoCtx);
        drawCropMarks(versoPage, x, y);
      });
    }
  }

  return pdfDoc.save();
};

// ---- Export PDF (masse)
export const generateFinalCardsPDF = async (students, classInfo, collegeInfo, options = {}) => {
  const bytes = await buildFinalCardsPdfBytes(students, classInfo, collegeInfo, options);
  const suffix = options.layout === 'pvc' ? 'pvc' : 'a4';
  downloadFile(bytes, `cartes_${classInfo?.code || 'export'}_${suffix}.pdf`);
};

// ---- Export PDF d'une seule carte (recto + verso, format carte)
export const generateSingleCardPDF = async (student, classInfo, collegeInfo, options = {}) => {
  const bytes = await buildFinalCardsPdfBytes([student], classInfo, collegeInfo, {
    ...options,
    layout: 'pvc',
  });
  downloadFile(bytes, `carte_${student?.matricule || 'eleve'}.pdf`);
};

// ---- Impression directe (boite de dialogue systeme -> choix imprimante PVC)
export const printFinalCards = async (students, classInfo, collegeInfo, options = {}) => {
  const confirmed = window.confirm(
    "⚠️ AVANT D'IMPRIMER — vérifiez le réglage d'échelle\n\n" +
    "Dans la boîte de dialogue d'impression, sélectionnez :\n" +
    "✓ \"Taille réelle\" ou \"100%\"\n" +
    "✗ PAS \"Ajuster à la page\" ni \"Réduire pour ajuster\"\n\n" +
    "Un mauvais réglage produira des cartes trop petites ou trop grandes " +
    "pour le format PVC standard (85,6 × 53,98 mm).\n\n" +
    "Continuer vers l'impression ?"
  );
  if (!confirmed) return;

  const bytes = await buildFinalCardsPdfBytes(students, classInfo, collegeInfo, options);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const old = document.getElementById('fvs-print-frame');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'fvs-print-frame';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.src = url;
  document.body.appendChild(iframe);

  await new Promise((resolve) => {
    iframe.onload = () => setTimeout(resolve, 400);
  });

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch {
    window.open(url, '_blank');
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
// ============================================================================
// EXPORT PNG (une carte, 300 DPI)
// ============================================================================

const canvasCtxFor = (widthPx, cardWidthMm, cardHeightMm) => {
  const ratio = cardHeightMm / cardWidthMm;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = Math.round(widthPx * ratio);
  return canvas;
};

const cvHelpers = (ctx) => {
  const H = ctx.canvas.height;
  return {
    // y = coordonnee "PDF" (depuis le bas) -> baseline canvas
    text: (str, x, y, size, weight, color, align = 'left') => {
      const t = sanitize(str);
      if (!t) return;
      ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(t, x, H - y);
    },
    rect: (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, H - y - h, w, h);
    },
    strokeRect: (x, y, w, h, color, lw = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(x, H - y - h, w, h);
    },
    line: (x1, y1, x2, y2, color, lw = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, H - y1);
      ctx.lineTo(x2, H - y2);
      ctx.stroke();
    },
    image: (img, x, y, w, h) => ctx.drawImage(img, x, H - y - h, w, h),
    measure: (str, size, weight) => {
      ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      return ctx.measureText(sanitize(str)).width;
    },
  };
};

// Repli 2 lignes pour le canvas (equivalent de wrapText, mesure via cvHelpers.measure)
const wrapCanvasText = (d, text, size, weight, maxWidth, maxLines = 2) => {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (d.measure(test, size, weight) <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
};
const drawEnvelopeCv = (d, x, y, w, h, color = '#000') => {
  d.strokeRect(x, y, w, h, color, 1);
  d.line(x, y + h, x + w / 2, y + h * 0.35, color, 1);
  d.line(x + w, y + h, x + w / 2, y + h * 0.35, color, 1);
};

const drawRectoCanvas = (ctx, { student, classInfo, collegeInfo, logoImg, photoImg, year }) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const s = W / BASE_W;
  const u = (n) => n * s;
  const d = cvHelpers(ctx);
  const P = u(5);

  d.rect(0, 0, W, H, '#FFFFFF');

  const logoW = u(130);
  const logoH = logoImg ? logoW * (logoImg.height / logoImg.width) : u(27);
  if (logoImg) d.image(logoImg, P, H - P - logoH, logoW, logoH);

// APRÈS
  const cbX = P + logoW + u(4);
  const cbW = W - cbX - P;

  const nomText = (collegeInfo?.nom || '').toUpperCase();
  const hasSlogan = !!collegeInfo?.slogan;
  const adresseLigne = [collegeInfo?.adresse_postale, collegeInfo?.commune].filter(Boolean).join('   ');
  const hasAddr = !!(collegeInfo?.adresse_postale || collegeInfo?.commune);

  const NAME_MAX = u(7);
  const NAME_MIN = u(5);
  const SMALL_MAX = u(5.5);
  const SMALL_MIN = u(4);

  let nameLinesCount = 1;
  let totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
  let rowH = logoH / totalRows;
  let nameSizeCv = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
  const fitsOneLineCv = d.measure(nomText, nameSizeCv, 'bold') <= cbW;

  let finalLinesCv;
  if (fitsOneLineCv) {
    finalLinesCv = [nomText];
  } else {
    nameLinesCount = 2;
    totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
    rowH = logoH / totalRows;
    nameSizeCv = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
    finalLinesCv = wrapCanvasText(d, nomText, nameSizeCv, 'bold', cbW, 2);
  }
  const sloganSizeCv = hasSlogan ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;
  const addrSizeCv = hasAddr ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;

  let cy = H - P - nameSizeCv * 0.85;
  finalLinesCv.forEach((line) => {
    d.text(line, cbX + cbW / 2, cy, nameSizeCv, 'bold', '#000', 'center');
    cy -= nameSizeCv * 1.15;
  });
  if (hasSlogan) {
    d.text(collegeInfo.slogan, cbX + cbW / 2, cy, sloganSizeCv, 'italic', '#000', 'center');
    cy -= sloganSizeCv * 1.15;
  }
  if (hasAddr) {
    if (collegeInfo?.adresse_postale) {
      const iconH = addrSizeCv * 0.85;
      const iconW = iconH * 1.4;
      const gap = addrSizeCv * 0.45;
      const textW = d.measure(adresseLigne, addrSizeCv, 'normal');
      const blockW = iconW + gap + textW;
      const blockX = cbX + (cbW - blockW) / 2;
      drawEnvelopeCv(d, blockX, cy - iconH * 0.15, iconW, iconH, '#000');
      d.text(adresseLigne, blockX + iconW + gap, cy, addrSizeCv, 'normal', '#000', 'left');
    } else {
      d.text(collegeInfo.commune, cbX + cbW / 2, cy, addrSizeCv, 'normal', '#000', 'center');
    }
  }

  const titleY = H - P - logoH - u(11);
  d.text(`CARTE D'IDENTITE SCOLAIRE   ${year}`, W / 2, titleY, u(10), 'bold', '#000', 'center');
  const labelSize = u(8);
  const lineH = u(12);
  const rows = [
    ['Nom :', student?.nom || ''],
    ['Prénom(s) :', student?.prenom || ''],
    ['Né(e) le :', `${formatDateFr(student?.date_naissance)}${student?.lieu_naissance ? `   à   ${student.lieu_naissance}` : ''}`],
    ['Sexe :', formatSexe(student?.sexe)],
    ['Nationalité :', student?.nationalite || ''],
    ['Adresse :', student?.adresse || ''],
    ['Classe :', classInfo?.code || ''],
  ];

  const photoX = u(8);
  const rowsFirstBaseline = titleY - u(10);
  const ASCENT = 0.74;
  const DESCENT = 0.22;
  const rowsTop = rowsFirstBaseline + labelSize * ASCENT;
  const rowsBottom = rowsFirstBaseline - (rows.length - 1) * lineH - labelSize * DESCENT;
  const photoH = rowsTop - rowsBottom;
  const photoW = photoH * (35 / 45);
  const photoY = rowsBottom;
  d.rect(photoX, photoY, photoW, photoH, '#141414');
  if (photoImg) {
    const { w, h } = fitContain(photoImg.width, photoImg.height, photoW, photoH);
    d.image(photoImg, photoX + (photoW - w) / 2, photoY + (photoH - h) / 2, w, h);
  }
  d.text(`Mle : ${student?.matricule || ''}`, photoX + photoW / 2, photoY - u(9), u(7), 'bold', '#000', 'center');

  const infoX = photoX + photoW + u(9);
  let ry = titleY - u(10);
  rows.forEach(([label, value]) => {
    const lw = d.measure(label, labelSize, 'normal');
    d.text(label, infoX, ry, labelSize, 'normal', '#000');
    d.line(infoX, ry - u(1.6), infoX + lw, ry - u(1.6), '#000', Math.max(1, u(0.4)));
    d.text(value, infoX + lw + u(6), ry, labelSize, 'bold', '#000');
    ry -= lineH;
  });

  const bandW = u(85);
  const bandX = (W - bandW) / 2;
  const seg = bandW / 3;
  d.rect(bandX, u(8), seg, u(4.5), '#00873E');
  d.rect(bandX + seg, u(8), seg, u(4.5), '#FCD900');
  d.rect(bandX + seg * 2, u(8), seg, u(4.5), '#E31C24');

  const sigW = u(54);
  const sigH = u(19);
  const sigX = W - P - sigW;
  d.strokeRect(sigX, u(15), sigW, sigH, '#333', Math.max(1, u(0.5)));
  ctx.font = `italic ${u(4.2)}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = '#737373';
  ctx.textAlign = 'center';
  ctx.fillText("Signature de l'apprenant", sigX + sigW / 2, H - u(9));
};

const drawVersoCanvas = (ctx, { collegeInfo, qrImg, signImg, year }) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const s = W / BASE_W;
  const u = (n) => n * s;
  const d = cvHelpers(ctx);
  const P = u(6);

  d.rect(0, 0, W, H, '#FFFFFF');

  // ---- Bloc central : nom de l'etablissement en tres grande police (~70% de la largeur)
  const collegeName = sanitize((collegeInfo?.nom || '').toUpperCase());
  const NAME_MIN = u(8);
  const NAME_MAX = u(15);
  const nameMaxWidth = W - P * 2;
  const fit = fitTitleSize(
    (t, sz) => d.measure(t, sz, 'bold'),
    collegeName, W * 0.7, nameMaxWidth, NAME_MIN, NAME_MAX
  );

  const TOP_MARGIN = u(9);
  const ASCENT = 0.74;
  let cy = H - TOP_MARGIN - fit.size * ASCENT;
  const nameLines = fit.fits ? [collegeName] : wrapCanvasText(d, collegeName, fit.size, 'bold', nameMaxWidth, 2);
  nameLines.forEach((line) => {
    d.text(line, W / 2, cy, fit.size, 'bold', '#000', 'center');
    cy -= fit.size * 1.25;
  });
  cy -= u(3);

  if (collegeInfo?.telephone) {
    d.text(`TEL : ${collegeInfo.telephone}`, W / 2, cy, u(6.5), 'normal', '#000', 'center');
    cy -= u(11);
  }
  d.text(`CARTE D'IDENTITE SCOLAIRE : ${year}`, W / 2, cy, u(6.5), 'bold', '#000', 'center');
  cy -= u(16);

  const rightX = W * 0.42;
  const rightW = W * 0.58 - P;
  d.text('LE DIRECTEUR', rightX + rightW / 2, cy, u(6), 'bold', '#000', 'center');

  const sigBoxW = u(72);
  const sigBoxH = u(24);
  const sigX = rightX + (rightW - sigBoxW) / 2;
  const sigAreaTop = cy - u(9);
  const sigY = sigAreaTop - sigBoxH;

  if (signImg) {
    const { w, h } = fitContain(signImg.width, signImg.height, sigBoxW, sigBoxH);
    d.image(signImg, sigX + (sigBoxW - w) / 2, sigY + (sigBoxH - h) / 2, w, h);
  }
  // sinon : zone laissee vierge pour une signature manuscrite

  const nameY = sigY - u(8);
  const directorName = sanitize(`${collegeInfo?.directeur_prenom || ''} ${collegeInfo?.directeur_nom || ''}`.trim());
  if (directorName) {
    const dirSize = u(6.5);
    const dirW = d.measure(directorName, dirSize, 'bold');
    const nameCenterX = sigX + sigBoxW / 2;
    d.text(directorName, nameCenterX, nameY, dirSize, 'bold', '#000', 'center');
    d.line(nameCenterX - dirW / 2, nameY - u(2), nameCenterX + dirW / 2, nameY - u(2), '#000', Math.max(1, u(0.5)));
  }

  // ---- Bande tricolore centree sur toute la largeur de la carte
  const bandW = u(85);
  const bandX = (W - bandW) / 2;
  const seg = bandW / 3;
  d.rect(bandX, u(8), seg, u(4.5), '#00873E');
  d.rect(bandX + seg, u(8), seg, u(4.5), '#FCD900');
  d.rect(bandX + seg * 2, u(8), seg, u(4.5), '#E31C24');

  const qrSize = u(28);
  const qrX = u(14);
  const qrY = (H - qrSize) / 2 - u(6);
  if (qrImg) d.image(qrImg, qrX, qrY, qrSize, qrSize);
  else d.strokeRect(qrX, qrY, qrSize, qrSize, '#000', 1);
};

export const generateCardImages = async (students, classInfo, collegeInfo, options = {}) => {
  const {
    cardWidthMm = DEFAULT_CARD_MM.width,
    cardHeightMm = DEFAULT_CARD_MM.height,
    includeVerso = true,
    widthPx = 1012,
  } = options;

  const year = getSchoolYear();
  const logoImg = await loadHtmlImage('/logo.png');
  const signImg = await loadHtmlImage(signatureFileUrl(collegeInfo?.signature_path));
  let qrImg = null;
  try {
    qrImg = await loadHtmlImage(
      await QRCode.toDataURL(buildQrPayload(collegeInfo), { margin: 0, width: 400 })
    );
  } catch {
    qrImg = null;
  }

  for (const student of students) {
    const photoImg = await loadHtmlImage(photoFileUrl(student.photo_path));

    const recto = canvasCtxFor(widthPx, cardWidthMm, cardHeightMm);
    drawRectoCanvas(recto.getContext('2d'), { student, classInfo, collegeInfo, logoImg, photoImg, year });
    await downloadCanvas(recto, `carte_${student.matricule}_recto.png`);

    if (includeVerso) {
      const verso = canvasCtxFor(widthPx, cardWidthMm, cardHeightMm);
      drawVersoCanvas(verso.getContext('2d'), { collegeInfo, qrImg, signImg, year });
      await downloadCanvas(verso, `carte_${student.matricule}_verso.png`);
    }
  }
};

// Compatibilite ascendante
export const generateFinalCardsImages = generateCardImages;

// ============================================================================
// BROUILLON EXPORT (tableau — une ligne par eleve) — INCHANGE
// ============================================================================

const BROUILLON_COLUMNS = [
  { key: 'photo', label: 'Photo', width: 45 },
  { key: 'matricule', label: 'Matricule', width: 60 },
  { key: 'nom', label: 'Nom', width: 95 },
  { key: 'prenom', label: 'Prénom', width: 120 },
  { key: 'classe', label: 'Classe', width: 55 },
  { key: 'date_naissance', label: 'Date de naissance', width: 80 },
  { key: 'lieu_naissance', label: 'Lieu de naissance', width: 100 },
  { key: 'nationalite', label: 'Nationalité', width: 100 },
  { key: 'telephone', label: 'Téléphone parent/tuteur', width: 126.89 },
];

const appendClassBrouillonPages = async (pdfDoc, font, fontBold, students, classInfo, collegeInfo) => {
  const PAGE_WIDTH = 841.89;
  const PAGE_HEIGHT = 595.28;
  const MARGIN = 30;
  const ROW_HEIGHT = 46;
  const HEADER_ROW_HEIGHT = 24;
  const TITLE_HEIGHT = 46;

  const usableHeight = PAGE_HEIGHT - MARGIN * 2 - TITLE_HEIGHT - HEADER_ROW_HEIGHT;
  const rowsPerPage = Math.max(1, Math.floor(usableHeight / ROW_HEIGHT));

  const pages = [];
  for (let i = 0; i < students.length; i += rowsPerPage) {
    pages.push(students.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  const drawTitle = (page, pageIndex, totalPages) => {
    let y = PAGE_HEIGHT - MARGIN;
    page.drawText(sanitize(collegeInfo?.nom || 'Établissement'), {
      x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.05, 0.4, 0.25),
    });
    y -= 18;
    const loc = [collegeInfo?.commune, collegeInfo?.departement].filter(Boolean).join(' - ');
  if (loc) {
    page.drawText(loc, {
      x: MARGIN, y, size: 9, font: font, color: rgb(0.3, 0.3, 0.3),
    });
    y -= 16;
  } else {
    y -= 16;
  }
    page.drawText(
      `Brouillon — Classe ${classInfo?.code || ''}  ·  ${students.length} élève${students.length > 1 ? 's' : ''}  ·  page ${pageIndex + 1}/${totalPages}`,
      { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }
    );
  };

  const drawHeaderRow = (page, topY) => {
    page.drawRectangle({
      x: MARGIN, y: topY - HEADER_ROW_HEIGHT,
      width: PAGE_WIDTH - MARGIN * 2, height: HEADER_ROW_HEIGHT,
      color: rgb(0.06, 0.4, 0.27),
    });
    let x = MARGIN;
    BROUILLON_COLUMNS.forEach((col) => {
      page.drawText(col.label, {
        x: x + 6, y: topY - HEADER_ROW_HEIGHT + 8,
        size: 8.5, font: fontBold, color: rgb(1, 1, 1),
      });
      x += col.width;
    });
  };

  const drawColumnSeparators = (page, top, bottom) => {
    let x = MARGIN;
    BROUILLON_COLUMNS.forEach((col) => {
      page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
      x += col.width;
    });
    page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  };

  for (let p = 0; p < pages.length; p++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawTitle(page, p, pages.length);

    const tableTop = PAGE_HEIGHT - MARGIN - TITLE_HEIGHT;
    drawHeaderRow(page, tableTop);

    const rows = pages[p];
    const images = await Promise.all(rows.map((s) => embedStudentPhoto(pdfDoc, s.photo_path)));

    let rowTop = tableTop - HEADER_ROW_HEIGHT;

    rows.forEach((student, idx) => {
      const rowBottom = rowTop - ROW_HEIGHT;

      if (idx % 2 === 1) {
        page.drawRectangle({
          x: MARGIN, y: rowBottom,
          width: PAGE_WIDTH - MARGIN * 2, height: ROW_HEIGHT,
          color: rgb(0.97, 0.98, 0.97),
        });
      }

      let x = MARGIN;
      const pdfImage = images[idx];
      const photoCol = BROUILLON_COLUMNS[0];
      const boxSize = ROW_HEIGHT - 10;
      if (pdfImage) {
        const { w, h } = fitContain(pdfImage.width, pdfImage.height, boxSize, boxSize);
        page.drawImage(pdfImage, {
          x: x + (photoCol.width - w) / 2,
          y: rowBottom + (ROW_HEIGHT - h) / 2,
          width: w, height: h,
        });
      } else {
        page.drawRectangle({
          x: x + (photoCol.width - boxSize) / 2, y: rowBottom + 5,
          width: boxSize, height: boxSize, color: rgb(0.94, 0.94, 0.94),
        });
      }
      x += photoCol.width;

      const values = {
        matricule: student.matricule,
        nom: student.nom,
        prenom: student.prenom,
        classe: classInfo?.code || '',
        date_naissance: formatDateFr(student.date_naissance),
        lieu_naissance: student.lieu_naissance || '',
        nationalite: student.nationalite || '',
        adresse: student.adresse || '',
      };

      BROUILLON_COLUMNS.slice(1).forEach((col) => {
        page.drawText(truncateText(font, values[col.key], 9, col.width - 12), {
          x: x + 6, y: rowBottom + ROW_HEIGHT / 2 - 4,
          size: 9, font, color: rgb(0.15, 0.15, 0.15),
        });
        x += col.width;
      });

      page.drawLine({
        start: { x: MARGIN, y: rowBottom }, end: { x: PAGE_WIDTH - MARGIN, y: rowBottom },
        thickness: 0.5, color: rgb(0.88, 0.88, 0.88),
      });

      rowTop = rowBottom;
    });

    drawColumnSeparators(page, tableTop, rowTop);
  }
};

export const generateBrouillonPDF = async (students, classInfo, collegeInfo) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  await appendClassBrouillonPages(pdfDoc, font, fontBold, students, classInfo, collegeInfo);
  downloadFile(await pdfDoc.save(), `brouillon_${classInfo?.code || 'cartes'}.pdf`);
};

export const generateCollegeBrouillonPDF = async (classesWithStudents, collegeInfo) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for (const { classInfo, students } of classesWithStudents) {
    await appendClassBrouillonPages(pdfDoc, font, fontBold, students, classInfo, collegeInfo);
  }
  downloadFile(await pdfDoc.save(), `brouillon_${collegeInfo?.nom || 'college'}.pdf`);
};

// ============================================================================
// UTILITAIRES
// ============================================================================

const downloadFile = (data, filename) => {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadCanvas = (canvas, filename) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });