import type { UserEvent } from '@testing-library/user-event';
import { describe, it } from 'vitest';
import { shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { waitForLaterMillisecond } from './createRenderer';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { createHeldBranch } from './heldBranch';

/**
 * The shared case of a part that owns a composite list. The part mounts while `KeepAlive` holds its
 * branch, and its last item mounts in a later flush. Then the branch shows. A sort in a held flush
 * finds no item, so an item that mounts after it can take an index that another item has. That
 * index stays wrong when the show starts no sort. A family that uses the list only for the index
 * thus shows the fault only with the late item.
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
   * Returns the part that owns the list and its items. Render the last item only when
   * `withLastItem` is `true`. It becomes `true` in a later flush, while the branch is still held.
   */
  renderList: (withLastItem: boolean) => VNodeChild;
  /**
   * Asserts a result that needs each item. It can first do a step of a user, such as a press of an
   * arrow key.
   */
  check: (user: UserEvent) => Promise<void> | void;
}
