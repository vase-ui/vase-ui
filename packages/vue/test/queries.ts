import { getQueriesForElement, queries, screen as domScreen } from '@testing-library/dom';
import type { BoundFunctions, Screen } from '@testing-library/dom';
import { vi } from 'vitest';
import { waitFor } from './waitFor';

type Query = (container: HTMLElement, ...args: unknown[]) => unknown;

// A `findBy` query of Testing Library waits with a limit of 1 s. Each `findBy` query here waits
// with `waitFor` of the test helpers, so its limit is a count of frames. The query runs in a frame
// callback, so the stack of its error has no line of the test. `vi.defineHelper` gives the error
// the stack of the call.
const frameLimitedQueries = { ...queries };
for (const name of Object.keys(queries)) {
  if (name.startsWith('find')) {
    const get = Reflect.get(queries, name.replace('find', 'get')) as Query;
    const find: Query = (container, matcher, options, waitForOptions) => {
      if (waitForOptions !== undefined) {
        throw new TypeError(
          'A `findBy` query of the test helpers takes no options for its wait. Its limit is 180 frames of the page.',
        );
      }
      return waitFor(() => get(container, matcher, options));
    };
    Reflect.set(frameLimitedQueries, name, vi.defineHelper(find));
  }
}

export type BoundQueries = BoundFunctions<typeof queries>;

// These queries replace the queries of the `screen` of Testing Library. Its `debug` stays.
export const screen: Screen = {
  ...domScreen,
  ...getQueriesForElement(document.body, frameLimitedQueries),
};

export function within(element: HTMLElement): BoundQueries {
  return getQueriesForElement(element, frameLimitedQueries);
}
