import { TestRunner } from 'vitest';
import { Fragment, transformVNodeArgs } from 'vue';

export function checkFragmentChildren() {
  // A Vapor slot reads a virtual DOM Fragment before Vue normalizes its children.
  transformVNodeArgs((args) => {
    const [type, , children] = args;
    if (type === Fragment && Array.isArray(children)) {
      for (const child of children) {
        if (child == null || typeof child === 'boolean') {
          // A listed Vue failure must not hide an invalid Fragment in the fixture.
          const test = TestRunner.getCurrentTest();
          if (test?.fails) {
            test.fails = false;
          }
          throw new Error('A Fragment has an empty child. Omit the child or use a comment vnode.');
        }
      }
    }
    return args;
  });
  return () => transformVNodeArgs();
}
