/**
 * Public-domain composer portraits (Wikimedia Commons), cropped to squares in
 * public/portraits. Living or unknown people get none — the app draws a planet.
 */
export const PORTRAITS: Record<string, { name: string; credit: string }> = {
  beethoven: { name: 'Ludwig van Beethoven', credit: 'Joseph Karl Stieler, 1820' },
  bach: { name: 'Johann Sebastian Bach', credit: 'Elias Gottlob Haussmann, 1748' },
  mozart: { name: 'Wolfgang Amadeus Mozart', credit: 'Johann Nepomuk della Croce, c. 1780' },
  chopin: { name: 'Frédéric Chopin', credit: 'Photograph by Louis-Auguste Bisson, 1849' },
  debussy: { name: 'Claude Debussy', credit: 'Photograph by Atelier Nadar, c. 1900' },
  satie: { name: 'Erik Satie', credit: 'Photograph by Henri Manuel, 1920' },
  tchaikovsky: { name: 'Pyotr Ilyich Tchaikovsky', credit: 'Photograph by Émile Reutlinger, 1888' },
  grieg: { name: 'Edvard Grieg', credit: 'Photograph, Bergen Public Library (no known restrictions)' },
  joplin: { name: 'Scott Joplin', credit: 'Photograph, 1912' },
  burgmuller: { name: 'Friedrich Burgmüller', credit: 'Lithograph by Fr. Meyer, c. 1840' },
  vivaldi: { name: 'Antonio Vivaldi', credit: 'Unknown painter, 1723' },
  brahms: { name: 'Johannes Brahms', credit: 'Photograph by C. Brasch, 1889' },
  offenbach: { name: 'Jacques Offenbach', credit: 'Photograph by Nadar' },
  pierpont: { name: 'James Lord Pierpont', credit: 'Photograph, 19th century' },
  newton: { name: 'John Newton', credit: 'Contemporary portrait, 18th century' },
};

const MATCH: [RegExp, string][] = [
  [/beethoven/i, 'beethoven'],
  [/\bbach\b/i, 'bach'],
  [/mozart/i, 'mozart'],
  [/chopin/i, 'chopin'],
  [/debussy/i, 'debussy'],
  [/satie/i, 'satie'],
  [/tchaikovsky/i, 'tchaikovsky'],
  [/grieg/i, 'grieg'],
  [/joplin/i, 'joplin'],
  [/burgm/i, 'burgmuller'],
  [/vivaldi/i, 'vivaldi'],
  [/brahms/i, 'brahms'],
  [/offenbach/i, 'offenbach'],
  [/pierpont/i, 'pierpont'],
  [/newton/i, 'newton'],
];

export function portraitKey(composer: string): string | null {
  for (const [re, key] of MATCH) if (re.test(composer)) return key;
  return null;
}
