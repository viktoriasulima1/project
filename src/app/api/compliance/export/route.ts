import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { gatherExportRecords, buildExportContext } from '@/lib/compliance-export/data';
import { buildComplianceCsv } from '@/lib/compliance-export/csv';
import { buildComplianceDiaryPdf, buildComplianceDiaryPlainText } from '@/lib/compliance-export/pdf';
import { computeExportChecksum } from '@/lib/compliance-export/checksum';
import { recordComplianceExportProvenance } from '@/lib/compliance-export/provenance';

export const dynamic = 'force-dynamic';

/**
 * Sprint 19 Part 10/11/13 — generates and streams a compliance export as a
 * download, and records its provenance (ComplianceExport + an `exported`
 * audit event) in the same request. A Route Handler, not a Server Action,
 * because a Server Action cannot return an arbitrary binary
 * Content-Disposition download — see node_modules/next/dist/docs's
 * route.js reference (Request Body / Non-UI Responses sections).
 *
 * Every filter (fieldIds/crops/productIds/seasonId) is only ever used to
 * narrow a query that is ALREADY scoped to this farm's own id
 * (`gatherExportRecords` → `getEffectiveComplianceRecords`, both farm-id
 * scoped throughout) — a crafted id belonging to another farm simply
 * matches nothing, never another farm's data (Part 14).
 */
const ExportRequestSchema = z.object({
  format: z.enum(['pdf', 'csv']),
  plaintext: z.boolean().optional(),
  filters: z.object({
    seasonId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    fieldIds: z.array(z.string().uuid()).optional(),
    crops: z.array(z.string()).optional(),
    productIds: z.array(z.string().uuid()).optional(),
    effectiveOnly: z.boolean(),
    includeReversed: z.boolean(),
    includeIncomplete: z.boolean(),
    includeCorrectionHistory: z.boolean(),
  }),
});

export async function POST(request: Request) {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return Response.json({ error: 'Sign in and set up a farm before exporting.' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = ExportRequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Invalid export request.' }, { status: 400 });
  }

  const actorUserId = await getClerkUserId();
  // "Include correction history" means "show every version" — it overrides
  // whatever the client sent for effectiveOnly directly, rather than
  // trusting two independent, potentially-contradictory flags.
  const resolvedFilters = { ...parsed.filters, effectiveOnly: !parsed.filters.includeCorrectionHistory };

  const records = await gatherExportRecords(farm.id, resolvedFilters);
  const ctx = await buildExportContext(farm.id, resolvedFilters);
  const checksum = computeExportChecksum(records);

  let body: Uint8Array;
  let contentType: string;
  let extension: string;

  if (parsed.format === 'csv') {
    body = Buffer.from(buildComplianceCsv(records, ctx), 'utf-8');
    contentType = 'text/csv; charset=utf-8';
    extension = 'csv';
  } else if (parsed.plaintext) {
    body = Buffer.from(buildComplianceDiaryPlainText(records, ctx), 'utf-8');
    contentType = 'text/plain; charset=utf-8';
    extension = 'txt';
  } else {
    body = await buildComplianceDiaryPdf(records, ctx);
    contentType = 'application/pdf';
    extension = 'pdf';
  }

  await db.$transaction(async (tx) => {
    await recordComplianceExportProvenance(tx, {
      farmId: farm.id,
      actorUserId,
      format: parsed.format,
      filters: resolvedFilters,
      recordCount: records.length,
      checksum,
    });
  });

  const filename = `farmos-spray-diary-${ctx.exportId}.${extension}`;
  return new Response(body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(body.length),
    },
  });
}
