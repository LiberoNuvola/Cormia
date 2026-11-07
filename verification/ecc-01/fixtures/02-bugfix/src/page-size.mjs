// Synthetic fixture. Contains one intentional off-by-one defect.
export function normalizePageSize(input) {
  const value = Number(input);

  if (!Number.isInteger(value) || value < 1) {
    return 10;
  }

  // Intentional defect: the maximum should be 50, not 51.
  return Math.min(value, 51);
}
