/**
 * SQL sanitization and parameter redaction
 */

/**
 * Sanitize SQL by collapsing whitespace
 */
export function sanitizeSql(sql: string): string {
  if (!sql || typeof sql !== "string") {
    return "";
  }
  return sql.replace(/\s+/g, " ").trim();
}

/**
 * Redact parameters with default or custom redactor
 */
export function redactParams(
  params: unknown[],
  redactor?: (params: unknown[]) => unknown[],
): unknown[] {
  if (redactor) {
    return redactor(params);
  }

  // Default: replace all with [REDACTED]
  return params.map(() => "[REDACTED]");
}
