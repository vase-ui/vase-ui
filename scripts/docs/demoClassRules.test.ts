import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { CLASS_NAMES_WITHOUT_RULE, classNamesWithoutRule } from './demoClassRules.ts';
import { loadDemoFamilies } from './upstreamDemos.ts';

test('a class name of a color in the theme has a rule, and a class name of another color has none', async () => {
  assert.deepEqual(await classNamesWithoutRule(['text-red-300', 'text-red-400']), ['text-red-300']);
});

test('the class names of the Tailwind demos that have no rule are the names of the list, and no other', async () => {
  const folders = new Map<string, Set<string>>();
  for (const { name, vueClasses } of loadDemoFamilies(REPOSITORY_ROOT)) {
    for (const [key, row] of vueClasses) {
      for (const className of Object.values(row)
        .flat()
        .flatMap((text) => text.split(' '))) {
        folders.set(
          className,
          (folders.get(className) ?? new Set()).add(`docs/demos/${name}/${key}`),
        );
      }
    }
  }
  const withoutRule = await classNamesWithoutRule([...folders.keys()]);
  const problems = [
    ...withoutRule
      .filter((className) => !CLASS_NAMES_WITHOUT_RULE.has(className))
      .map(
        (className) =>
          `The class name ${className} adds no rule to docs/demos/tailwind.css. Folders: ${[...(folders.get(className) ?? [])].join(', ')}. Add the color to the theme when the theme of the Base UI docs has it. Else add the name to CLASS_NAMES_WITHOUT_RULE with its reason.`,
      ),
    ...[...CLASS_NAMES_WITHOUT_RULE]
      .filter((className) => !withoutRule.includes(className))
      .map(
        (className) =>
          `The class name ${className} is in CLASS_NAMES_WITHOUT_RULE, but ${folders.has(className) ? 'it adds a rule to docs/demos/tailwind.css' : 'no Tailwind demo has it'}. Delete it from the list.`,
      ),
  ];
  assert.deepEqual(problems, []);
});
