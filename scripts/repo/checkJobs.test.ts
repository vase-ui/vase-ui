import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { jobRunCommands } from './workflowJob.ts';

test('the job `check` of the release runs each command of the job `check` of CI, in the same sequence', () => {
  const ci = jobRunCommands(
    readRepositoryFile(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
    'check',
  );
  const release = jobRunCommands(
    readRepositoryFile(REPOSITORY_ROOT, '.github/workflows/release.yml'),
    'check',
  );
  assert.deepEqual(
    release.filter((command) => ci.includes(command)),
    ci,
  );
});
