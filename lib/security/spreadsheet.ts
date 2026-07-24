export function sanitizeForSheetCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  const trimmedStart = text.trimStart();

  if (/^[=+\-@]/.test(trimmedStart)) {
    return `'${text}`;
  }

  return text;
}
