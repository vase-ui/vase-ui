import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { CLASS_NAMES_WITHOUT_RULE, classNamesWithoutRule } from './demoClassRules.ts';
import { loadDemoFamilies } from './upstreamDemos.ts';

test('a class name of a color in the theme has a rule, and a class name of another color has none', async () => {
  assert.deepEqual(await classNamesWithoutRule(['text-red-400', 'text-red-300']), ['text-red-300']);
});

test('the class names of the Tailwind demos that have no rule are the names of the list, and no other', async () => {
  const folders = new Map<string, Set<string>>();
  // A class string of a ported demo is that of Base UI, so the name stays. A demo of Vase UI's own
  // has class strings of its own, so the name is corrected there.
  const ported = new Set<string>();
  for (const { name, own, vueClasses } of loadDemoFamilies(REPOSITORY_ROOT)) {
    for (const [key, row] of vueClasses) {
      for (const className of Object.values(row)
        .flat()
        .flatMap((text) => text.split(' '))) {
        folders.set(
          className,
          (folders.get(className) ?? new Set()).add(`docs/demos/${name}/${key}`),
        );
        if (!own) {
          ported.add(className);
        }
      }
    }
  }
  const withoutRule = await classNamesWithoutRule([...folders.keys()]);
  const problems = [
    ...withoutRule
      .filter((className) => !CLASS_NAMES_WITHOUT_RULE.has(className))
      .map(
        (className) =>
          `The class name ${className} adds no rule to docs/demos/tailwind.css. Folders: ${[...(folders.get(className) ?? [])].join(', ')}. ${
            ported.has(className)
              ? 'Add the color to the theme when the theme of the Base UI docs has it. Else add the name to CLASS_NAMES_WITHOUT_RULE with its reason.'
              : 'Base UI does not have this demo. Use a class name that gives a rule, with a color of the theme.'
          }`,
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
