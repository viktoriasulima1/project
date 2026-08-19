export interface ExportRequestFilters {
  seasonId?: string;
  dateFrom?: string;
  dateTo?: string;
  fieldIds?: string[];
  crops?: string[];
  productIds?: string[];
  /** Part 12 defaults: effective records only, reversed excluded, incomplete
   * included but marked, correction history summarized (not expanded). */
  effectiveOnly: boolean;
  includeReversed: boolean;
  includeIncomplete: boolean;
  includeCorrectionHistory: boolean;
}

export const DEFAULT_EXPORT_FILTERS: ExportRequestFilters = {
  effectiveOnly: true,
  includeReversed: false,
  includeIncomplete: true,
  includeCorrectionHistory: false,
};

export interface ExportContext {
  exportId: string;
  farmName: string;
  farmLegalName: string | null;
  farmLocation: string;
  seasonLabel: string;
  dateRangeLabel: string;
  generatedAt: Date;
  farmOsVersion: string;
}

export const FARMOS_VERSION = '0.2.0';

export const EXPORT_DISCLAIMER =
  'Generated from user-entered and integrated source data. Verify against the product label and official ' +
  'requirements before relying on this document. FarmOS does not certify legal compliance. Reversed records are ' +
  'excluded by default. Corrections are represented by the current effective version.';
