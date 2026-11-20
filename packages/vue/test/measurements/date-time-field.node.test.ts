// A measurement of Node.js, with no code of the library, for the layout of DateField.
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

// So `getSegmentLayout` keeps its path around a pattern with the year of the week. When a release
// of Node.js fixes the fault, this case fails, and the path goes.
test('`formatToParts` ends the process of Node.js for a pattern with the year of the week', () => {
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      "new Intl.DateTimeFormat('my', { calendar: 'buddhist', year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).formatToParts(0)",
    ],
    { encoding: 'utf8' },
  );
  expect(child.signal).not.toBe(null);
});
