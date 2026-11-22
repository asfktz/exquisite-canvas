export function secs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function statusText(p: number) {
  if (p < 0.18) return 'Reading the edges…';
  if (p < 0.45) return 'Sketching the composition…';
  if (p < 0.75) return 'Matching colours at the seams…';
  return 'Final strokes…';
}
export const OBJ_NAMES = ['fish balloon', 'sleepy moon', 'balloon', 'stilt house'];
