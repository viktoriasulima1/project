export function findVisibleDomainCodeLeaks(userVisibleContent: string, codes: readonly string[]): string[] {
  return codes.filter((code) => userVisibleContent.includes(code));
}
