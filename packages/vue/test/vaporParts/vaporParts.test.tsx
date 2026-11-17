import { Checkbox } from '@vase-ui/vue/checkbox';
import { expect, it } from 'vitest';
import { isVaporParts } from '#test-utils';
import expectations from './expectedFailures.json' with { type: 'json' };

it('compiles a part as a Vapor component only in the project of the Vapor parts', () => {
  expect((Checkbox.Root as { __vapor?: boolean }).__vapor === true).toBe(isVaporParts);
});

it('each expected failure names a cause of the list', () => {
  for (const [file, { fails }] of Object.entries(expectations.files)) {
    for (const [name, cause] of Object.entries(fails)) {
      expect(Object.hasOwn(expectations.causes, cause), `${file} > ${name}`).toBe(true);
    }
  }
});

it('each cause of the list has an expected failure', () => {
  const usedCauses = new Set(
    Object.values(expectations.files).flatMap(({ fails }) => Object.values(fails)),
  );
  expect([...usedCauses].sort()).toEqual(Object.keys(expectations.causes).sort());
});

it('each cause has a summary, and its link is a URL of an issue', () => {
  for (const cause of Object.values(expectations.causes)) {
    expect(cause.summary.trim().length).toBeGreaterThan(0);
    const link = new URL(cause.link);
    expect(link.protocol).toBe('https:');
    expect(link.hostname).toBe('github.com');
    expect(link.pathname).toMatch(/^\/vuejs\/core\/issues\/\d+$/);
  }
});
