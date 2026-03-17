/**
 * Normalizes different datetime representations into an ISO 8601 string.
 */
export const normalizeDate = (
  value: string | number | Date | null | undefined
): string | undefined => {
  if (value === null || value === undefined) {
      return undefined;
  }
  
  try {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
          return undefined;
      }
      return d.toISOString();
  } catch {
      return undefined;
  }
};
