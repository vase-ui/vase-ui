import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useDomEffect } from '../utils/popups/useDomEffect';
import { useAnimationsFinished } from './useAnimationsFinished';

// Popover and Menu have different types for `instantType`, so only the members that the
// composable uses are typed.
interface TriggerSwitchStore {
  // The composable reads the state, not the selector. The selector hides `trigger-change` while
  // the popup is closed, and that is the time when the composable must clear it.
  readonly state: { readonly instantType: string | undefined };
  set(key: 'instantType', value: 'trigger-change' | undefined): void;
  select(key: 'open'): boolean;
}

export interface UseTriggerSwitchTransitionParameters {
  store: TriggerSwitchStore;
  /**
   * The trigger element that currently owns the popup.
   */
  domReference: MaybeRefOrGetter<Element | null>;
  positionerElement: MaybeRefOrGetter<HTMLElement | null>;
  open: MaybeRefOrGetter<boolean>;
}

/**
 * Lets the positioner animate while a popup moves between detached triggers.
 *
 * The positioner has `data-instant` while `instantType` is set. A style of the consumer can turn
 * the transitions off with that attribute, and a move to another trigger would then jump. The
 * composable clears `instantType` for the time of the move, so that the positioner can
 * transition. It sets `trigger-change` when the animations of the move end.
 *
 * That write waits for the animations, so it can outlive the move that scheduled it. The popup
 * keeps its trigger element through the exit transition, so a close does not change
 * `domReference`, and nothing else would stop the write. A popup that closes and opens again on
 * the same trigger during its exit would then keep the old write and lose its own transition. A
 * close thus cancels the write.
 *
 * A controlled `open` of `false` reaches the popup with no call of `setOpen`. The selector of
 * `instantType` thus also stops a closed popup from showing `trigger-change`.
 *
 * Call it in `setup`.
 */
export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
  const { store, domReference, positionerElement, open } = parameters;

  let previousTrigger: Element | null = null;
  let pendingSwitch: AbortController | null = null;
  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);

  useDomEffect([() => toValue(open)], () => {
    if (toValue(open)) {
      return;
    }

    pendingSwitch?.abort();
    pendingSwitch = null;

    // `trigger-change` belongs to the open cycle that wrote it. The selector hides it while the
    // popup is closed, but the value must go too. A controlled reopen changes only the `open`
    // prop, so no later write would replace it, and the selector would show it in the new cycle.
    if (store.state.instantType === 'trigger-change') {
      store.set('instantType', undefined);
    }
  });

  useDomEffect([() => toValue(domReference)], () => {
    const currentTrigger = toValue(domReference);
    const lastTrigger = previousTrigger;

    if (currentTrigger) {
      previousTrigger = currentTrigger;
    }

    if (!lastTrigger || !currentTrigger || currentTrigger === lastTrigger) {
      return undefined;
    }

    // A trigger element can also change while the popup closes, when a new element replaces a
    // trigger. There is no move to animate. The cancel effect above has already run for this
    // update, so a write that this effect schedules would stay for the next open.
    if (!store.select('open')) {
      return undefined;
    }

    store.set('instantType', undefined);

    const abortController = new AbortController();
    pendingSwitch = abortController;

    runOnceAnimationsFinish(() => {
      // A close aborts the write. The animations can end in the same frame as the close, before
      // the abort. The write then would leave `trigger-change` for the next open.
      if (store.select('open')) {
        store.set('instantType', 'trigger-change');
      }
    }, abortController.signal);

    return () => {
      abortController.abort();
    };
  });
}
