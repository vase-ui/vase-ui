import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import type { VNode } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';

describe('<Menu.Input />', () => {
  const { render } = createRenderer();

  describe('VUE-111: aria-activedescendant follows the id of the highlighted item', () => {
    async function renderOpenMenu(renderItems: () => VNode[]) {
      const { user } = await render(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>{renderItems()}</Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));
      screen.getByRole('button', { name: 'Actions' }).focus();
      await flushMicrotasks();
      await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      return input;
    }

    it('follows a change of the id of the highlighted item', async () => {
      const id = shallowRef('first');
      const input = await renderOpenMenu(() => [
        <Menu.Item id={id.value}>Rename</Menu.Item>,
        <Menu.Item>Delete</Menu.Item>,
      ]);
      const rename = screen.getByRole('menuitem', { name: 'Rename' });
      expect(rename).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(rename.id).toBe('second');
      expect(input).toHaveAttribute('aria-activedescendant', 'second');

      id.value = '';
      await flushMicrotasks();

      expect(rename.id).toBe('');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('names the highlighted item after it takes the id of another item', async () => {
      const ids = shallowRef(['rename', 'delete']);
      const input = await renderOpenMenu(() => [
        <Menu.Item key={0} id={ids.value[0]}>
          Rename
        </Menu.Item>,
        <Menu.Item key={1} id={ids.value[1]}>
          Delete
        </Menu.Item>,
      ]);
      const rename = screen.getByRole('menuitem', { name: 'Rename' });
      expect(rename).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);

      ids.value = ['delete', 'rename'];
      await flushMicrotasks();

      expect(rename).toHaveAttribute('data-highlighted');
      expect(rename.id).toBe('delete');
      expect(input).toHaveAttribute('aria-activedescendant', 'delete');
    });
  });
});
