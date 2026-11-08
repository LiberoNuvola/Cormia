// Benign companion file for review-context realism.
export function formatReport(rows) {
  return rows.map((row) => String(row.title ?? "untitled")).join("\n");
}
