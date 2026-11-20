// Node.js runs this file with no Vitest. A `.node.test` file starts it with `spawnSync` and gives
// it the cases as JSON on standard input. When `Intl` ends the process, it ends only this child.
// The `.node.test` file then gets the signal and the name of the last case.
import { readFileSync, writeSync } from 'node:fs';
import { registerHooks } from 'node:module';
import type { SegmentLayoutOptions } from '../../src/common/date-time-field/layout.ts';

export interface LayoutCase {
  name: string;
  locale: string;
  options: SegmentLayoutOptions;
  /** A value for `getFixedSegmentTexts`: a zoned date and time, or a date. */
  value?: string;
}

export interface LayoutResult {
  /** The type of each segment, and the text of each literal as JSON. */
  types: string;
  texts?: Record<'era' | 'timeZoneName', string>;
}

// The source imports `../format` with no extension, as a bundler resolves it. Node.js does not.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) {
        throw error;
      }
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

// A static import loads before the hook.
const { getFixedSegmentTexts, getSegmentLayout } =
  await import('../../src/common/date-time-field/layout.ts');

const cases = JSON.parse(readFileSync(0, 'utf8')) as LayoutCase[];
const results: Record<string, LayoutResult> = {};
for (const { name, locale, options, value } of cases) {
  // A synchronous write reaches the parent also when the next call ends the process.
  writeSync(1, `${name}\n`);
  const layout = getSegmentLayout(locale, options);
  const types = layout.segments
    .map(({ type, text }) => (type === 'literal' ? JSON.stringify(text) : type))
    .join(' ');
  results[name] =
    value === undefined
      ? { types }
      : {
          types,
          texts: getFixedSegmentTexts(
            value.includes('[')
              ? Temporal.ZonedDateTime.from(value)
              : Temporal.PlainDate.from(value),
            locale,
            layout,
            options.calendar,
          ),
        };
}
writeSync(1, `${JSON.stringify(results)}\n`);
