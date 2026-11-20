import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { compileSampleFile, listSampleFiles, readPageSnippets } from './sampleCompile.ts';

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sample-compile-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    const fullPath = join(root, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, text);
  }
  return root;
}

const UNREADABLE_BASE_TS = [
  'export type WithEvent<T> = { [K in keyof T]: T[K] };',
  'export interface Attributes { title?: string }',
  'export interface BaseProps extends WithEvent<Attributes> { open?: boolean }',
].join('\n');

test('readPageSnippets gives the path and the line number of each VitePress snippet form', () => {
  const text = [
    '<<< ./Plain.vue',
    '<<< ./Lines.vue{3,7}',
    '<<< ./Region.vue#region{ts}',
    '<<< ./Titled.vue [Sample title]',
    '  <<< ./Indented.vue',
    '<<< @/examples/AtRoot.vue#part{1,2} [From docs]',
    '<<< ./Bracketed.vue{ts twoslash} [Props [1]]',
  ].join('\n');
  assert.deepEqual(readPageSnippets(text), [
    { line: 1, path: './Plain.vue' },
    { line: 2, path: './Lines.vue' },
    { line: 3, path: './Region.vue' },
    { line: 4, path: './Titled.vue' },
    { line: 5, path: './Indented.vue' },
    { line: 6, path: '@/examples/AtRoot.vue' },
    { line: 7, path: './Bracketed.vue' },
  ]);
});

test('readPageSnippets gives nothing for lines that do not start with <<< and a path', () => {
  const text = ['# Page', 'Show a sample with <<< ./Sample.vue in Markdown.', '<<<   ', ''].join(
    '\n',
  );
  assert.deepEqual(readPageSnippets(text), []);
});

test('listSampleFiles collects docs Vue files outside .vitepress and node_modules plus shown Vue files outside docs', () => {
  const root = makeTree({
    'docs/examples/Sample.vue': '<template><div /></template>\n',
    'docs/.vitepress/theme/Layout.vue': '<template><div /></template>\n',
    'docs/.vitepress/notes.md': '<<< ./AbsentInVitepress.vue\n',
    'docs/node_modules/pkg/Ignored.vue': '<template><div /></template>\n',
    'fixtures/Outside.vue': '<template><div /></template>\n',
    'docs/demos/style.css': '.demo {}\n',
    'docs/components/helper.ts': 'export const value = 1;\n',
    'docs/components/page.md': [
      '# Component',
      '',
      '<<< ../../fixtures/Outside.vue',
      '<<< @/examples/Sample.vue',
      '<<< ../demos/style.css',
      '<<< ./helper.ts',
    ].join('\n'),
  });
  assert.deepEqual(listSampleFiles(root), {
    files: ['docs/examples/Sample.vue', 'fixtures/Outside.vue'],
    problems: [],
  });
});

test('listSampleFiles reports a <<< line that names an absent Vue file with the page and the line number', () => {
  const root = makeTree({
    'docs/components/button.md': ['# Button', '', '<<< ./Absent.vue'].join('\n'),
  });
  const result = listSampleFiles(root);
  assert.deepEqual(result.files, []);
  assert.equal(result.problems.length, 1);
  assert.match(
    result.problems[0],
    /^docs\/components\/button\.md:3: .*docs\/components\/Absent\.vue/,
  );
});

test('listSampleFiles reports a sample that no page shows or imports and no shown sample imports', () => {
  const sample = '<template><div /></template>\n';
  const root = makeTree({
    'docs/components/button.md': [
      '<script setup>',
      "import Live from './button/Live.vue';",
      '</script>',
      '',
      '<<< ./button/Shown.vue',
    ].join('\n'),
    'docs/components/button/Shown.vue':
      "<script setup>\nimport Part from './Part.vue';\n</script>\n",
    'docs/components/button/Part.vue': sample,
    'docs/components/button/Live.vue': sample,
    'docs/components/button/Orphan.vue': sample,
    'docs/examples/styling/Orphan.vue': sample,
    'docs/examples/type-check/Typed.vue': sample,
    'docs/demos/button/hero/css-modules/index.vue': sample,
  });
  assert.deepEqual(listSampleFiles(root).problems, [
    'docs/components/button/Orphan.vue: no page shows or imports this sample, and no shown sample imports it. Show it on a page with <<<, or delete it.',
    'docs/examples/styling/Orphan.vue: no page shows or imports this sample, and no shown sample imports it. Show it on a page with <<<, or delete it.',
  ]);
});

test('listSampleFiles at REPOSITORY_ROOT includes docs samples, unshown examples and shown fixture files with no problem', () => {
  const { files, problems } = listSampleFiles(REPOSITORY_ROOT);
  assert.deepEqual(problems, []);
  assert.ok(files.includes('docs/utils/csp-provider/NonceApp.vue'));
  assert.ok(files.includes('docs/examples/composition/MyButton.vue'));
  assert.ok(files.includes('fixtures/nuxt/app/components/ResizableCookieLayout.vue'));
});

test('compileSampleFile refuses a props interface that extends an unreadable imported type and keeps the full message', () => {
  const sample = [
    '<script setup lang="ts">',
    "import type { BaseProps } from './base';",
    'interface Props extends BaseProps { size?: number }',
    'defineProps<Props>();',
    '</script>',
    '<template><div /></template>',
  ].join('\n');
  const root = makeTree({ 'base.ts': UNREADABLE_BASE_TS, 'Sample.vue': sample });
  const problem = compileSampleFile(join(root, 'Sample.vue'), sample, root);
  assert.ok(problem !== undefined);
  assert.match(problem, /^Sample\.vue:/);
  assert.match(problem, /Failed to resolve extends base type/);
  assert.match(problem, /\/\* @vue-ignore \*\//);
});

test('compileSampleFile accepts the same sample with /* @vue-ignore */ before the base type', () => {
  const sample = [
    '<script setup lang="ts">',
    "import type { BaseProps } from './base';",
    'interface Props extends /* @vue-ignore */ BaseProps { size?: number }',
    'defineProps<Props>();',
    '</script>',
    '<template><div /></template>',
  ].join('\n');
  const root = makeTree({ 'base.ts': UNREADABLE_BASE_TS, 'Sample.vue': sample });
  assert.equal(compileSampleFile(join(root, 'Sample.vue'), sample, root), undefined);
});

test('compileSampleFile reports a parse error in a Vue file', () => {
  const sample = '<template><div></template>\n';
  const root = makeTree({ 'Sample.vue': sample });
  const problem = compileSampleFile(join(root, 'Sample.vue'), sample, root);
  assert.ok(problem !== undefined);
  assert.match(problem, /^Sample\.vue:.*Element is missing end tag/);
});

test('compileSampleFile reports a template error in a file with a script block', () => {
  const setupSample = [
    '<script setup lang="ts">',
    'const items = [1];',
    '</script>',
    '<template><div v-for="items" /></template>',
  ].join('\n');
  const setupRoot = makeTree({ 'Sample.vue': setupSample });
  const setupProblem = compileSampleFile(join(setupRoot, 'Sample.vue'), setupSample, setupRoot);
  assert.ok(setupProblem !== undefined);
  assert.match(setupProblem, /^Sample\.vue:.*v-for has invalid expression/);

  const scriptSample = [
    '<script lang="ts">',
    'export default {};',
    '</script>',
    '<template><div v-for="items" /></template>',
  ].join('\n');
  const scriptRoot = makeTree({ 'Sample.vue': scriptSample });
  const scriptProblem = compileSampleFile(join(scriptRoot, 'Sample.vue'), scriptSample, scriptRoot);
  assert.ok(scriptProblem !== undefined);
  assert.match(scriptProblem, /^Sample\.vue:.*v-for has invalid expression/);
});

test('compileSampleFile compiles the template of a file that has no script block', () => {
  const invalid = '<template><div v-for="items" /></template>\n';
  const invalidRoot = makeTree({ 'Invalid.vue': invalid });
  const problem = compileSampleFile(join(invalidRoot, 'Invalid.vue'), invalid, invalidRoot);
  assert.ok(problem !== undefined);
  assert.match(problem, /^Invalid\.vue:.*v-for has invalid expression/);

  const valid = '<template><div>Plain text</div></template>\n';
  const validRoot = makeTree({ 'Valid.vue': valid });
  assert.equal(compileSampleFile(join(validRoot, 'Valid.vue'), valid, validRoot), undefined);
});

test('docs:typecheck in the root package.json runs sampleCompile.ts after the docs type check', () => {
  const pkg = JSON.parse(readRepositoryFile(REPOSITORY_ROOT, 'package.json')) as {
    scripts?: Record<string, string>;
  };
  const steps = (pkg.scripts?.['docs:typecheck'] ?? '').split('&&').map((step) => step.trim());
  assert.deepEqual(steps, [
    'pnpm --filter @vase-ui/docs typecheck',
    'node scripts/docs/sampleCompile.ts',
  ]);
});
