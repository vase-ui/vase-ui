import type { UserEvent } from '@testing-library/user-event';
import { describe, it } from 'vitest';
import { shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { waitForLaterMillisecond } from './createRenderer';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { createHeldBranch } from './heldBranch';

/**
 * The shared case of a part whose items register with a composite list. The list mounts while
 * `KeepAlive` holds its branch, its last item mounts in a later flush, and then the branch shows.
 * A user then needs each item, for example to move the focus with an arrow key.
 */
export function heldMountListTests(config: HeldMountListTestsConfig) {
  const { render, renderList, check } = config;

  describe('a list that mounts while KeepAlive holds its branch', () => {
    it('has each item after the show', async () => {
      const withLastItem = shallowRef(false);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() =>
        renderList(withLastItem.value),
      );
      const { user } = await render(() => <HeldBranch />);

      await mountWhileHeld();
      withLastItem.value = true;
      await flushMicrotasks();
      await waitForLaterMillisecond(show);

      await check(user);
    });
  });
}

export interface HeldMountListTestsConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Returns the part that owns the list, with two or more items. Render the last item only when
   * `withLastItem` is `true`. It becomes `true` in a later flush, while the branch is still held.
   */
  renderList: (withLastItem: boolean) => VNodeChild;
  /**
   * Does the step of a user that needs each item, and asserts its result.
   */
  check: (user: UserEvent) => Promise<void> | void;
}
