import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { DEMO_VARIANT_STORAGE_KEY } from '../../docs/.vitepress/components/demoVariantStorageKey.ts';
import config from '../../docs/.vitepress/config.ts';

/** The text of each inline script in the head of a page. */
const scripts = (config.head ?? []).flatMap((entry) =>
  entry[0] === 'script' && entry.length === 3 ? [entry[2]] : [],
);

/** Runs the scripts of the head with `getItem` as the storage, and gives the data of the root. */
function runHeadScripts(getItem: (key: string) => string | null): Record<string, string> {
  const dataset: Record<string, string> = {};
  for (const script of scripts) {
    runInNewContext(script, {
      localStorage: { getItem },
      document: { documentElement: { dataset } },
    });
  }
  return dataset;
}

const CASES: {
  name: string;
  getItem: (key: string) => string | null;
  expected: Record<string, string>;
}[] = [
  {
    name: 'sets the Tailwind variant on the root for a stored Tailwind choice',
    getItem: (key) => (key === DEMO_VARIANT_STORAGE_KEY ? 'tailwind' : null),
    expected: { demoVariant: 'tailwind' },
  },
  {
    name: 'sets no variant for a stored CSS Modules choice',
    getItem: (key) => (key === DEMO_VARIANT_STORAGE_KEY ? 'css-modules' : null),
    expected: {},
  },
  {
    name: 'sets no variant when the storage has no choice',
    getItem: () => null,
    expected: {},
  },
  {
    name: 'sets no variant and throws no error when the browser refuses the storage',
    getItem: () => {
      throw new Error('The storage is not available.');
    },
    expected: {},
  },
];

for (const { name, getItem, expected } of CASES) {
  test(`the script in the head ${name}`, () => {
    assert.deepEqual(runHeadScripts(getItem), expected);
  });
}
