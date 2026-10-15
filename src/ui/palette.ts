/**
 * The 8 Player Colors, based on the colour-blind-safe Okabe–Ito palette, with black replaced by grey
 * and vermilion by a true red so it can't be mistaken for orange.
 */
export const PALETTE: readonly { readonly name: string; readonly fill: string }[] = [
  { name: 'Orange', fill: '#E69F00' },
  { name: 'Sky blue', fill: '#56B4E9' },
  { name: 'Green', fill: '#009E73' },
  { name: 'Yellow', fill: '#F0E442' },
  { name: 'Blue', fill: '#0072B2' },
  { name: 'Red', fill: '#C62828' },
  { name: 'Pink', fill: '#CC79A7' },
  { name: 'Grey', fill: '#999999' },
];

export function colorOf(colorId: number): string {
  return PALETTE[colorId]?.fill ?? '#888888';
}

/** Dark or light text, whichever reads better on a #rrggbb background. */
export function textOn(background: string): string {
  const n = parseInt(background.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1d1f24' : '#ffffff';
}
