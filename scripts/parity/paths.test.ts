import assert from 'node:assert/strict';
import { test } from 'node:test';
import { counterparts, hasCounterpart, matchesAny, vaseFiles } from './paths.ts';

const counterpartRules: { name: string; upstream: string; files: string[]; expected: string[] }[] =
  [
    {
      name: 'a utils source file maps to common',
      upstream: 'packages/utils/src/clamp.ts',
      files: ['packages/vue/src/common/clamp.ts'],
      expected: ['packages/vue/src/common/clamp.ts'],
    },
    {
      name: 'a component source file can be an SFC',
      upstream: 'packages/react/src/dialog/root/DialogRoot.tsx',
      files: ['packages/vue/src/dialog/root/DialogRoot.vue'],
      expected: ['packages/vue/src/dialog/root/DialogRoot.vue'],
    },
    {
      name: 'a source file can be a .ts file or a .tsx file',
      upstream: 'packages/react/src/dialog/index.ts',
      files: ['packages/vue/src/dialog/index.ts', 'packages/vue/src/dialog/index.tsx'],
      expected: ['packages/vue/src/dialog/index.ts', 'packages/vue/src/dialog/index.tsx'],
    },
    {
      name: 'a test file is a .ts file or a .tsx file, and not an SFC',
      upstream: 'packages/react/src/dialog/root/DialogRoot.test.tsx',
      files: [
        'packages/vue/src/dialog/root/DialogRoot.test.vue',
        'packages/vue/src/dialog/root/DialogRoot.test.ts',
      ],
      expected: ['packages/vue/src/dialog/root/DialogRoot.test.ts'],
    },
    {
      name: 'a type test is a .ts file or a .tsx file',
      upstream: 'packages/utils/src/addEventListener.spec.ts',
      files: ['packages/vue/src/common/addEventListener.spec.tsx'],
      expected: ['packages/vue/src/common/addEventListener.spec.tsx'],
    },
    {
      name: 'a test root file maps to the test folder',
      upstream: 'packages/react/test/describeConformance.tsx',
      files: ['packages/vue/test/describeConformance.ts'],
      expected: ['packages/vue/test/describeConformance.ts'],
    },
    {
      name: 'a file that is not a script has the same name',
      upstream: 'packages/react/src/tabs/indicator/prehydrationScript.template.js',
      files: [
        'packages/vue/src/tabs/indicator/prehydrationScript.template.js',
        'packages/vue/src/tabs/indicator/prehydrationScript.template.ts',
      ],
      expected: ['packages/vue/src/tabs/indicator/prehydrationScript.template.js'],
    },
    {
      name: 'a folder maps to a folder',
      upstream: 'packages/react/src/dialog',
      files: ['packages/vue/src/dialog/index.ts'],
      expected: ['packages/vue/src/dialog'],
    },
    {
      name: 'a folder with no file in it has no counterpart',
      upstream: 'packages/react/src/dialog',
      files: ['packages/vue/src/popover/index.ts'],
      expected: [],
    },
    {
      name: 'a path outside the mapped roots has no counterpart',
      upstream: 'docs/src/app/page.tsx',
      files: ['packages/vue/src/app/page.tsx', 'docs/src/app/page.tsx'],
      expected: [],
    },
  ];

for (const { name, upstream, files, expected } of counterpartRules) {
  test(`counterparts: ${name}`, () => {
    assert.deepEqual(counterparts(upstream, vaseFiles(files)), expected);
    assert.equal(hasCounterpart(upstream, vaseFiles(files)), expected.length > 0);
  });
}

test('matchesAny reads * as one folder, ** as many folders, and a parenthesis as itself', () => {
  assert.equal(matchesAny('packages/utils/src/a.ts', ['packages/utils/src/**']), true);
  assert.equal(matchesAny('packages/utils/src/store/a.ts', ['packages/utils/src/**']), true);
  assert.equal(matchesAny('packages/utils/src/store/a.ts', ['packages/utils/src/*']), false);
  assert.equal(
    matchesAny('docs/src/app/(docs)/react/components/dialog/types.md', [
      'docs/src/app/(docs)/react/components/*/types.md',
    ]),
    true,
  );
  assert.equal(matchesAny('packages/react/src/a.ts', ['packages/utils/src/**']), false);
});
