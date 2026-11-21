import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { jobRunCommands } from './workflowJob.ts';

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const manifest: Manifest = JSON.parse(
  readRepositoryFile(REPOSITORY_ROOT, 'packages/vue/package.json'),
);
const vueRange = manifest.peerDependencies?.vue ?? '';
const floor = /^\^(\d+\.\d+\.\d+)(?= |$)/.exec(vueRange)?.[1];

test('the package has two run-time dependencies, the peer `vue`, and the optional peer `nuxt` of its Nuxt module', () => {
  assert.deepEqual(
    Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).sort(),
    ['@floating-ui/utils', '@floating-ui/vue'],
  );
  assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}).sort(), ['nuxt', 'vue']);
  assert.deepEqual(manifest.peerDependenciesMeta, { nuxt: { optional: true } });
});

test('the peer range of `vue` starts with the lowest version', () => {
  assert.ok(
    floor !== undefined,
    `The range "${vueRange}" must start with "^" and the lowest version, such as "^3.5.12 || ^3.6.0-0".`,
  );
});

test('the job `test-vue-floor` of CI installs the lowest version of the peer range', () => {
  const commands = jobRunCommands(
    readRepositoryFile(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
    'test-vue-floor',
  );
  const installed = commands.flatMap((command) => / vue@(\S+)$/.exec(command)?.[1] ?? []);
  assert.deepEqual(installed, [floor]);
});

test('docs/quick-start.md names the lowest version of the peer range', () => {
  const page = readRepositoryFile(REPOSITORY_ROOT, 'docs/quick-start.md');
  const versions: string[] = page.match(/\d+(?:\.\d+)+/g) ?? [];
  assert.ok(
    floor !== undefined && versions.includes(floor),
    `The page names these versions: ${versions.join(', ')}.`,
  );
});

test('CONTRIBUTING.md names the lowest version of the peer range', () => {
  const guide = readRepositoryFile(REPOSITORY_ROOT, 'CONTRIBUTING.md');
  const version = /The lowest version of Vue that the package supports is (\d+\.\d+\.\d+)\./.exec(
    guide,
  )?.[1];
  assert.equal(version, floor);
});

test('each Playwright image of CI has the version of `playwright`', () => {
  const tags = Array.from(
    readRepositoryFile(REPOSITORY_ROOT, '.github/workflows/ci.yml').matchAll(
      /^ +image: mcr\.microsoft\.com\/playwright:(\S+)$/gm,
    ),
    (match) => match[1],
  );
  assert.ok(tags.length > 0);
  assert.deepEqual(
    tags,
    tags.map(() => `v${manifest.devDependencies?.playwright}-noble`),
  );
});
