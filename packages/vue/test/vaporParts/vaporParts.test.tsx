import { Checkbox } from '@vase-ui/vue/checkbox';
import { expect, it } from 'vitest';
import { createCommentVNode, Fragment, h } from 'vue';
import { isVaporParts } from '#test-utils';
import expectations from './expectedFailures.json' with { type: 'json' };

it('compiles a part as a Vapor component only in the project of the Vapor parts', () => {
  expect((Checkbox.Root as { __vapor?: boolean }).__vapor === true).toBe(isVaporParts);
});

it.runIf(isVaporParts).each([
  { name: 'null', child: null },
  { name: 'undefined', child: undefined },
  { name: 'false', child: false },
  { name: 'true', child: true },
])('rejects a Fragment with $name as a child', ({ child }) => {
  expect(() => h(Fragment, [h('span'), child])).toThrow('A Fragment has an empty child');
});

it('accepts a comment vnode for an empty branch of a Fragment', () => {
  const children = [h('span'), createCommentVNode()];
  expect(h(Fragment, children).children).toEqual(children);
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
