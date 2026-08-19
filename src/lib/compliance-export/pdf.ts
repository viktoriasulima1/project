import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ExportContext } from './types';
import { EXPORT_DISCLAIMER } from './types';
import { maskCertificateNumber } from '@/lib/pii-masking';

/**
 * Sprint 19 Part 10 — the professional PDF spray diary export.
 *
 * Layout choice, stated plainly: this renders ONE BLOCK PER RECORD (a
 * bordered card of labeled fields), not a dense multi-column table row per
 * record. A real spray diary needs roughly 20 fields per application
 * (date, field, crop, area, product, authorisation number, dose, water
 * volume, operator, machine, nozzle, BBCH, weather, status, ...) — fitting
 * that many columns on A4 in a font size a farmer or inspector can actually
 * read is not achievable without clipping something. A per-record block
 * guarantees "no clipped columns" by construction (there are no columns to
 * clip) and reads more like the paper spray-diary templates this replaces.
 */

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 48;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function statusLabel(status: string): string {
  return {
    complete: 'Complete',
    incomplete: 'Incomplete',
    corrected: 'Corrected',
    reversed: 'Reversed',
    verification_unavailable: 'Verification unavailable',
  }[status] ?? status;
}

function fieldLines(r: EffectiveComplianceRecord): [string, string][] {
  const d = r.data as {
    fieldName?: string; crop?: string; fieldHectares?: string; areaHa?: number; productName?: string;
    productRegistrationNumber?: string; ctgbSelectedUse?: { cropOrUseTarget?: string } | null; ctgbComplianceStatus?: string;
    dosePerHa?: number; doseUnit?: string; waterVolumePerHa?: number; operatorName?: string; certificateNumber?: string | null;
    machineName?: string; nozzleType?: string; bbchStage?: number; weatherTempC?: number; weatherWindKmh?: number;
    weatherHumidity?: number;
  };
  const totalQuantity = d.dosePerHa != null && d.areaHa != null ? (d.dosePerHa * d.areaHa).toFixed(2) : '—';
  const weather = [
    d.weatherTempC != null ? `${d.weatherTempC}°C` : null,
    d.weatherWindKmh != null ? `${d.weatherWindKmh} km/h wind` : null,
    d.weatherHumidity != null ? `${d.weatherHumidity}% humidity` : null,
  ].filter(Boolean).join(', ') || 'not recorded';

  return [
    ['Field', `${d.fieldName ?? '—'} (${d.fieldHectares ?? '—'} ha total)`],
    ['Crop', (d.crop ?? '—').replace(/_/g, ' ')],
    ['Treated area', d.areaHa != null ? `${d.areaHa} ha` : '—'],
    ['Product', d.productName ?? '— (manual entry / not recorded)'],
    ['Authorisation number', d.productRegistrationNumber ?? '—'],
    ['Ctgb verification', d.ctgbComplianceStatus ? d.ctgbComplianceStatus.replace(/_/g, ' ') : 'manual / unverified'],
    ['Intended use', d.ctgbSelectedUse?.cropOrUseTarget ?? '—'],
    ['Dose', d.dosePerHa != null ? `${d.dosePerHa} ${d.doseUnit ?? ''}/ha` : '—'],
    ['Total quantity', totalQuantity !== '—' ? `${totalQuantity} ${d.doseUnit ?? ''}` : '—'],
    ['Water volume', d.waterVolumePerHa != null ? `${d.waterVolumePerHa} L/ha` : '—'],
    ['Operator', d.operatorName ?? '—'],
    ['Certificate', maskCertificateNumber(d.certificateNumber)],
    ['Machine', d.machineName ?? '—'],
    ['Nozzle', d.nozzleType ?? '—'],
    ['BBCH stage', d.bbchStage != null ? String(d.bbchStage) : '—'],
    ['Weather', weather],
    ['Record status', `${statusLabel(r.completeness.status)}${r.correctionCount > 0 ? ` (${r.correctionCount} correction${r.correctionCount !== 1 ? 's' : ''})` : ''}`],
  ];
}

export async function buildComplianceDiaryPdf(records: EffectiveComplianceRecord[], ctx: ExportContext): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawPageHeader(p: PDFPage) {
    let hy = PAGE_HEIGHT - MARGIN;
    p.drawText(ctx.farmName, { x: MARGIN, y: hy, size: 16, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) });
    hy -= 18;
    if (ctx.farmLegalName) {
      p.drawText(ctx.farmLegalName, { x: MARGIN, y: hy, size: 9, font: fonts.regular, color: rgb(0.4, 0.4, 0.4) });
      hy -= 12;
    }
    p.drawText(ctx.farmLocation, { x: MARGIN, y: hy, size: 9, font: fonts.regular, color: rgb(0.4, 0.4, 0.4) });
    hy -= 14;
    p.drawText('EU Spray Diary', { x: MARGIN, y: hy, size: 12, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) });
    hy -= 14;
    p.drawText(`${ctx.seasonLabel} · ${ctx.dateRangeLabel}`, { x: MARGIN, y: hy, size: 9, font: fonts.regular, color: rgb(0.3, 0.3, 0.3) });
    hy -= 12;
    p.drawText(
      `Generated ${ctx.generatedAt.toISOString()} · FarmOS v${ctx.farmOsVersion} · Export ID ${ctx.exportId}`,
      { x: MARGIN, y: hy, size: 7, font: fonts.regular, color: rgb(0.5, 0.5, 0.5) },
    );
    hy -= 16;
    p.drawLine({ start: { x: MARGIN, y: hy }, end: { x: PAGE_WIDTH - MARGIN, y: hy }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    return hy - 14;
  }

  y = drawPageHeader(page);

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawPageHeader(page);
  }

  if (records.length === 0) {
    page.drawText('No records match the selected filters.', { x: MARGIN, y, size: 11, font: fonts.regular });
  }

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const lines = fieldLines(r);
    const rowHeight = 12;
    const blockHeight = 20 + lines.length * rowHeight + 10;

    if (y - blockHeight < MARGIN + FOOTER_HEIGHT) {
      newPage();
    }

    const blockTop = y;
    const d = r.data as { fieldName?: string; crop?: string };
    const title = `Record ${i + 1} — ${r.date.toISOString().slice(0, 10)} — ${d.fieldName ?? '—'}`;
    page.drawRectangle({
      x: MARGIN, y: blockTop - blockHeight, width: CONTENT_WIDTH, height: blockHeight,
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.75,
    });
    page.drawText(title, { x: MARGIN + 8, y: blockTop - 14, size: 10, font: fonts.bold });
    if (r.isReversal) {
      page.drawText('REVERSED', { x: PAGE_WIDTH - MARGIN - 70, y: blockTop - 14, size: 9, font: fonts.bold, color: rgb(0.7, 0.1, 0.1) });
    } else if (r.correctionCount > 0) {
      page.drawText('CORRECTED', { x: PAGE_WIDTH - MARGIN - 75, y: blockTop - 14, size: 9, font: fonts.bold, color: rgb(0.1, 0.3, 0.7) });
    }

    let ly = blockTop - 30;
    const colWidth = CONTENT_WIDTH / 2 - 16;
    for (let li = 0; li < lines.length; li++) {
      const [label, value] = lines[li];
      const col = li % 2;
      const rowY = ly - Math.floor(li / 2) * rowHeight;
      const x = MARGIN + 8 + col * (colWidth + 24);
      page.drawText(`${label}:`, { x, y: rowY, size: 8, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
      const valueLines = wrapText(String(value), fonts.regular, 8, colWidth - 60);
      page.drawText(valueLines[0] ?? '', { x: x + 62, y: rowY, size: 8, font: fonts.regular });
    }

    y = blockTop - blockHeight - 10;
  }

  const totalPages = pdfDoc.getPageCount();
  const disclaimerLines = wrapText(EXPORT_DISCLAIMER, fonts.regular, 7, CONTENT_WIDTH);
  pdfDoc.getPages().forEach((p, idx) => {
    let fy = MARGIN + FOOTER_HEIGHT - 10;
    p.drawLine({ start: { x: MARGIN, y: fy }, end: { x: PAGE_WIDTH - MARGIN, y: fy }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    fy -= 10;
    for (const line of disclaimerLines) {
      p.drawText(line, { x: MARGIN, y: fy, size: 6.5, font: fonts.regular, color: rgb(0.5, 0.5, 0.5) });
      fy -= 8;
    }
    p.drawText(`Export ${ctx.exportId} · Page ${idx + 1} of ${totalPages}`, {
      x: MARGIN, y: MARGIN - 10, size: 7, font: fonts.regular, color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdfDoc.save();
}

/** Sprint 19 Part 10 — "accessible plain-text fallback where practical."
 * The same facts as the PDF, in a plain-text form a screen reader or a
 * simple text viewer can read directly, with no layout/rendering to fail. */
export function buildComplianceDiaryPlainText(records: EffectiveComplianceRecord[], ctx: ExportContext): string {
  const lines: string[] = [];
  lines.push(`${ctx.farmName} — EU Spray Diary`);
  if (ctx.farmLegalName) lines.push(ctx.farmLegalName);
  lines.push(ctx.farmLocation);
  lines.push(`${ctx.seasonLabel} · ${ctx.dateRangeLabel}`);
  lines.push(`Generated ${ctx.generatedAt.toISOString()} · FarmOS v${ctx.farmOsVersion} · Export ID ${ctx.exportId}`);
  lines.push('');

  records.forEach((r, i) => {
    const d = r.data as { fieldName?: string };
    lines.push(`Record ${i + 1} — ${r.date.toISOString().slice(0, 10)} — ${d.fieldName ?? '—'}`);
    if (r.isReversal) lines.push('  [REVERSED]');
    else if (r.correctionCount > 0) lines.push(`  [CORRECTED — ${r.correctionCount} correction(s)]`);
    for (const [label, value] of fieldLines(r)) {
      lines.push(`  ${label}: ${value}`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push(EXPORT_DISCLAIMER);
  lines.push(`Export ID: ${ctx.exportId}`);
  return lines.join('\n');
}
