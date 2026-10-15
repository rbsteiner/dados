/** The 8 Player Colors, based on the colour-blind-safe Okabe–Ito palette (black replaced by grey). */
export const PALETTE: readonly { readonly name: string; readonly fill: string }[] = [
  { name: 'Orange', fill: '#E69F00' },
  { name: 'Sky blue', fill: '#56B4E9' },
  { name: 'Green', fill: '#009E73' },
  { name: 'Yellow', fill: '#F0E442' },
  { name: 'Blue', fill: '#0072B2' },
  { name: 'Red', fill: '#D55E00' },
  { name: 'Pink', fill: '#CC79A7' },
  { name: 'Grey', fill: '#999999' },
];

export function colorOf(colorId: number): string {
  return PALETTE[colorId]?.fill ?? '#888888';
}
