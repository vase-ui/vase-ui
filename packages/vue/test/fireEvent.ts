import { fireEvent as domFireEvent } from '@testing-library/dom';
import { nextTick } from 'vue';

type DomFireEvent = typeof domFireEvent;
type Fire<Args extends unknown[]> = (...args: Args) => boolean;

// The dispatch is synchronous: a listener runs before the first `await`.
function toAsync<Args extends unknown[]>(fire: Fire<Args>) {
  return async (...args: Args) => {
    const notPrevented = fire(...args);
    await nextTick();
    return notPrevented;
  };
}

const eventFunctions = Object.fromEntries(
  Object.entries(domFireEvent).map(([name, fire]) => [name, toAsync(fire as Fire<any[]>)]),
) as {
  [Name in keyof DomFireEvent]: (...args: Parameters<DomFireEvent[Name]>) => Promise<boolean>;
};

/**
 * Dispatches an event, waits for Vue to flush, and resolves to the result of the dispatch.
 * The result is `false` when a listener prevented the default action.
 */
export const fireEvent = Object.assign(toAsync(domFireEvent), eventFunctions);
