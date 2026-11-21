import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_RELATED_PATHS, selectTests, vitestCommand } from './selectTests.ts';
import type { Change, Selection } from './selectTests.ts';

const PACKAGE_FILES = [
  'packages/vue/src/common/server.node.test.ts',
  'packages/vue/src/common/platform/index.ts',
  'packages/vue/src/slider/SliderFamily.test.tsx',
  'packages/vue/src/slider/root/SliderRoot.test.tsx',
  'packages/vue/src/slider/thumb/SliderThumb.test.tsx',
  'packages/vue/src/slider/thumb/SliderThumb.vue',
  'packages/vue/src/slider/thumb/SliderThumbServer.test.vue',
  'packages/vue/test/hydration.test.tsx',
  'packages/vue/test/fixtures/PlainPart.vue',
  'packages/vue/test/fixtures/fixtures.node.test.tsx',
];

const ALL: Selection = { tests: 'all', related: [], fixtures: true };
const NONE: Selection = { tests: 'none', related: [], fixtures: false };

const modified = (...paths: string[]): Change[] => paths.map((path) => ({ status: 'M', path }));

const RUN_EACH_TEST_PATHS = [
  '.github/workflows/ci.yml',
  '.github/actions/vitest/action.yml',
  'scripts/ci/selectTests.ts',
  'package.json',
  'docs/package.json',
  'fixtures/nuxt/package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'patches/rolldown-plugin-dts@0.30.1.patch',
  '.node-version',
  'tsconfig.json',
  'docs/tsconfig.json',
  'packages/vue/tsconfig.test.json',
  'packages/vue/vitest.config.ts',
  'packages/vue/test/server/renderToHtml.ts',
  'packages/vue/test/server/printSegmentLayouts.ts',
  'packages/vue/test/webkitFullKeyboardAccess.sh',
  'parity/own/resizable.json',
];

for (const path of RUN_EACH_TEST_PATHS) {
  test(`${path} runs each test file`, () => {
    assert.deepEqual(selectTests(modified(path, 'CONTRIBUTING.md'), PACKAGE_FILES), ALL);
  });
}

const READ_BY_NO_TEST_PATHS = [
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'parity/upstream.json',
  'parity/better/BUG-1425.json',
  'scripts/docs/parityReport.ts',
  'eslint.config.js',
  'eslint.config.test.js',
  'prettier.config.js',
  'docs/public/mark.svg',
  'docs/components/slider.md',
  'docs/handbook/styling.md',
  'benchmarks/libraries/vase-ui/Dialog.vue',
];

for (const path of READ_BY_NO_TEST_PATHS) {
  test(`${path} runs no test file`, () => {
    assert.deepEqual(selectTests(modified(path), PACKAGE_FILES), NONE);
  });
}

const rows: { name: string; changes: Change[]; selection: Selection; files?: string[] }[] = [
  {
    name: 'a file that no rule names runs each test file',
    changes: modified('.editorconfig', 'CONTRIBUTING.md'),
    selection: ALL,
  },
  {
    name: 'a file of a fixture runs `test-nuxt` only',
    changes: modified('fixtures/nuxt/app/pages/slider.vue'),
    selection: { tests: 'none', related: [], fixtures: true },
  },
  {
    name: 'a configuration file of a fixture runs `test-nuxt` only',
    changes: modified('fixtures/vite/published/vite.config.ts'),
    selection: { tests: 'none', related: [], fixtures: true },
  },
  {
    name: 'a part: Vitest gets the part, and the test files of its folder and of each folder above',
    changes: modified('packages/vue/src/slider/thumb/SliderThumb.vue', 'CONTRIBUTING.md'),
    selection: {
      tests: 'related',
      related: [
        'packages/vue/src/slider/SliderFamily.test.tsx',
        'packages/vue/src/slider/thumb/SliderThumb.test.tsx',
        'packages/vue/src/slider/thumb/SliderThumb.vue',
      ],
      fixtures: true,
    },
  },
  {
    name: 'a test file: no folder rule, and the fixtures do not run',
    changes: modified('packages/vue/src/slider/root/SliderRoot.test.tsx'),
    selection: {
      tests: 'related',
      related: ['packages/vue/src/slider/root/SliderRoot.test.tsx'],
      fixtures: false,
    },
  },
  {
    name: 'a type test: the folder rule applies, and the fixtures do not run',
    changes: modified('packages/vue/src/slider/root/SliderRoot.spec.ts'),
    selection: {
      tests: 'related',
      related: [
        'packages/vue/src/slider/SliderFamily.test.tsx',
        'packages/vue/src/slider/root/SliderRoot.spec.ts',
        'packages/vue/src/slider/root/SliderRoot.test.tsx',
      ],
      fixtures: false,
    },
  },
  {
    name: 'a fixture SFC that its test gives to the server render by a path',
    changes: modified('packages/vue/src/slider/thumb/SliderThumbServer.test.vue'),
    selection: {
      tests: 'related',
      related: [
        'packages/vue/src/slider/SliderFamily.test.tsx',
        'packages/vue/src/slider/thumb/SliderThumb.test.tsx',
        'packages/vue/src/slider/thumb/SliderThumbServer.test.vue',
      ],
      fixtures: false,
    },
  },
  {
    name: 'a module below a test file that imports each module of its folder at run time',
    changes: modified('packages/vue/src/common/platform/index.ts'),
    selection: {
      tests: 'related',
      related: [
        'packages/vue/src/common/platform/index.ts',
        'packages/vue/src/common/server.node.test.ts',
      ],
      fixtures: true,
    },
  },
  {
    name: 'a file directly in the folder `test`: the test files of that folder run',
    changes: modified('packages/vue/test/index.ts'),
    selection: {
      tests: 'related',
      related: ['packages/vue/test/hydration.test.tsx', 'packages/vue/test/index.ts'],
      fixtures: false,
    },
  },
  {
    name: 'a build script of the package: the fixtures run, and no folder rule applies',
    changes: modified('packages/vue/scripts/build.ts'),
    selection: { tests: 'related', related: ['packages/vue/scripts/build.ts'], fixtures: true },
  },
  {
    name: 'a deleted file of the package: the test files of its folder run',
    changes: [{ status: 'D', path: 'packages/vue/test/fixtures/GonePart.vue' }],
    selection: {
      tests: 'related',
      related: [
        'packages/vue/test/fixtures/GonePart.vue',
        'packages/vue/test/fixtures/fixtures.node.test.tsx',
        'packages/vue/test/hydration.test.tsx',
      ],
      fixtures: false,
    },
  },
  {
    name: 'a demo: Vitest finds its test files in the module graph',
    changes: modified('docs/demos/slider/hero/css-modules/index.vue'),
    selection: {
      tests: 'related',
      related: ['docs/demos/slider/hero/css-modules/index.vue'],
      fixtures: false,
    },
  },
  {
    name: 'a deleted demo',
    changes: [{ status: 'D', path: 'docs/demos/slider/hero/css-modules/index.vue' }],
    selection: ALL,
  },
  {
    name: 'a deleted page',
    changes: [{ status: 'D', path: 'docs/components/slider.md' }],
    selection: NONE,
  },
  {
    name: 'a deleted file of `docs/public`',
    changes: [{ status: 'D', path: 'docs/public/mark.svg' }],
    selection: NONE,
  },
  {
    name: 'a path with a space',
    changes: modified('packages/vue/src/slider/thumb/Slider Thumb.vue'),
    selection: ALL,
  },
  {
    name: 'a path with a line break',
    changes: modified('docs/demos/slider/hero/css-modules/index.vue\ntests=none'),
    selection: ALL,
  },
  {
    name: 'a test file with a space that the folder rule adds',
    changes: modified('packages/vue/src/slider/thumb/SliderThumb.vue'),
    files: [...PACKAGE_FILES, 'packages/vue/src/slider/thumb/Slider Thumb.test.tsx'],
    selection: ALL,
  },
  {
    name: 'more files than the list can hold',
    changes: modified(
      ...Array.from({ length: MAX_RELATED_PATHS + 1 }, (_, index) => `docs/demos/a/${index}.vue`),
    ),
    selection: ALL,
  },
  {
    name: 'as many files as the list can hold',
    changes: modified(
      ...Array.from({ length: MAX_RELATED_PATHS }, (_, index) => `docs/demos/a/${index}.vue`),
    ),
    selection: {
      tests: 'related',
      related: Array.from(
        { length: MAX_RELATED_PATHS },
        (_, index) => `docs/demos/a/${index}.vue`,
      ).sort(),
      fixtures: false,
    },
  },
];

for (const row of rows) {
  test(row.name, () => {
    assert.deepEqual(selectTests(row.changes, row.files ?? PACKAGE_FILES), row.selection);
  });
}

test('the command of a selection with files has paths from the folder of the package', () => {
  assert.equal(
    vitestCommand({
      tests: 'related',
      related: ['docs/demos/a/index.vue', 'packages/vue/src/slider/thumb/SliderThumb.vue'],
      fixtures: true,
    }),
    'related --run ../../docs/demos/a/index.vue src/slider/thumb/SliderThumb.vue',
  );
});

test('the command of `all` and of `none` runs each test file', () => {
  assert.equal(vitestCommand(ALL), 'run');
  assert.equal(vitestCommand(NONE), 'run');
});
