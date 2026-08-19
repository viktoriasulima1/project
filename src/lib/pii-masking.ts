/**
 * Sprint 19 Part 15 — "Employee certificate numbers: display masked by
 * default." Applied wherever a spray operator's certificate number is
 * rendered for a human to read (the PDF export's per-record detail) —
 * never applied to the raw value stored in `ComplianceRecord.data` or the
 * CSV export (Part 11's own column list deliberately has no certificate
 * number column at all).
 */
export function maskCertificateNumber(cert: string | null | undefined): string {
  if (!cert) return 'not recorded';
  if (cert.length <= 4) return '••••';
  return `••••${cert.slice(-4)}`;
}
