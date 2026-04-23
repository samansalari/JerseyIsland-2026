/** Jersey 2026 parish / district names (aligned with `scripts/seed-candidates.ts`). */
export const JERSEY_DISTRICTS = [
  "St Helier North",
  "St Helier Central",
  "St Helier South",
  "St Saviour",
  "St Brelade",
  "St Clement",
  "St Peter",
  "St Lawrence",
  "St Mary",
  "St Ouen",
  "St John",
  "Trinity",
  "Grouville",
  "St Martin",
] as const;

export const JERSEY_DISTRICT_SET = new Set<string>(JERSEY_DISTRICTS);
