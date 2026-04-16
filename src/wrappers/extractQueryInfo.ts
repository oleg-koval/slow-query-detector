/**
 * Extract SQL and params from Prisma template literal query
 */

/**
 * Extract SQL and params from Prisma query
 * Prisma uses template literals: $queryRaw`SELECT * FROM users WHERE id = ${id}`
 * This converts to: $queryRaw(['SELECT * FROM users WHERE id = ', ''], id)
 */
export function extractQueryInfo(
  sql: TemplateStringsArray,
  ...values: unknown[]
): { sql: string; params: unknown[] } {
  // Handle edge case: empty template literal
  if (sql.length === 0) {
    return { sql: "", params: [] };
  }

  // Template literal: reconstruct SQL and collect params
  // Prisma uses $1, $2, etc. for PostgreSQL parameters
  // Template literal structure: sql.length === values.length + 1
  let reconstructedSql = "";
  const params: unknown[] = [];

  for (let i = 0; i < sql.length; i++) {
    reconstructedSql += sql[i];
    if (i < values.length) {
      params.push(values[i]);
      // Prisma uses $1, $2, etc. for PostgreSQL parameters
      reconstructedSql += `$${i + 1}`;
    }
  }

  return { sql: reconstructedSql.trim(), params };
}
