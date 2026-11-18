import { test, expect } from 'vitest';
import { planetDesign, PALETTES } from '../src/lib/ui/planets';

test('a planet design is the same every time for the same song', () => {
  expect(planetDesign('fur-elise', 'rose')).toEqual(planetDesign('fur-elise', 'rose'));
  expect(planetDesign('fur-elise', 'rose')).not.toEqual(planetDesign('moonlight', 'rose'));
});

test('bands tile seamlessly: every band path starts and ends at the same height', () => {
  const d = planetDesign('gymnopedie', 'ash');
  expect(d.bands.length).toBeGreaterThanOrEqual(5);
  for (const b of d.bands) {
    const nums = b.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // first point (x, y) and the point one period later on the top edge share y
    expect(nums[1]).toBeCloseTo(b.topAtPeriod, 1);
  }
});

test('every palette has the colours a planet needs', () => {
  for (const p of Object.values(PALETTES)) {
    expect(p.deep).toMatch(/^#/);
    expect(p.light).toMatch(/^#/);
  }
});
