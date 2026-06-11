export const POSITION_GAP = 1024;

export const nextPosition = (maxPosition: number | null) =>
  (maxPosition ?? 0) + POSITION_GAP;
