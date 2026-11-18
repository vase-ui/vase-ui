import { describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import type { VNode } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useMenuRootContext } from '../root/MenuRootContext';
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

  it('tracks focus only on the current search input', async () => {
    const key = shallowRef(0);
    const Inputs = defineComponent(() => {
      const { store } = useMenuRootContext(false);
      return () => (
        <>
          <Menu.Input key={key.value} />
          <output>{String(store.state.inputFocused)}</output>
        </>
      );
    });
    await render(
      <Menu.FilterProvider>
        <Menu.Root>
          <Inputs />
        </Menu.Root>
      </Menu.FilterProvider>,
    );
    const old = screen.getByRole('searchbox');
    key.value++;
    await nextTick();
    const input = screen.getByRole('searchbox');
    input.focus();
    await nextTick();
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('true');

    document.body.append(old);
    onTestFinished(() => old.remove());
    old.focus();
    await nextTick();
    expect(old).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('false');

    old.addEventListener('focusout', () => input.focus(), { capture: true, once: true });
    old.blur();
    await nextTick();
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('true');
  });

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
        <Menu.Item
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <div {...props} id={id.value}>
                Rename
              </div>
            ),
          }}
        />,
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
