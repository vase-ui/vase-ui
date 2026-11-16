import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jobRunCommands } from './workflowJob.ts';

const WORKFLOW = `name: CI

jobs:
  first:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      # A comment of a step.
      - name: Check the commit
        run: git merge-base --is-ancestor HEAD origin/main
      - run: pnpm lint

  # A comment before a job.
  second:
    steps:
      - run: pnpm build
  literal:
    steps:
      - run: |
          pnpm build
  folded:
    steps:
      - run: >-
          pnpm build
  empty:
    steps:
      - uses: actions/checkout@v7
`;

test('jobRunCommands gives the commands of one job, with and without a step name', () => {
  assert.deepEqual(jobRunCommands(WORKFLOW, 'first'), [
    'git merge-base --is-ancestor HEAD origin/main',
    'pnpm lint',
  ]);
});

test('jobRunCommands stops at the next job', () => {
  assert.deepEqual(jobRunCommands(WORKFLOW, 'second'), ['pnpm build']);
});

const refused: { name: string; job: string; problem: RegExp }[] = [
  { name: 'a job that the workflow does not have', job: 'third', problem: /no job "third"/ },
  {
    name: 'a command of more than one line, with |',
    job: 'literal',
    problem: /more than one line/,
  },
  { name: 'a command of more than one line, with >', job: 'folded', problem: /more than one line/ },
  { name: 'a job with no command', job: 'empty', problem: /no "run" step/ },
];

for (const { name, job, problem } of refused) {
  test(`jobRunCommands refuses ${name}`, () => {
    assert.throws(() => jobRunCommands(WORKFLOW, job), problem);
  });
}
