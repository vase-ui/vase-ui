import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import type { HTMLProps } from '../../internals/types';

describe('filtered Menu items', () => {
  const { render } = createRenderer();

  it('keeps focus on the input when items are pressed', async () => {
    const handleItemClick = vi.fn();
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item closeOnClick={false} onClick={handleItemClick}>
                    Rename
                  </Menu.Item>
                  <Menu.LinkItem href="#details">Open details</Menu.LinkItem>
                  <Menu.CheckboxItem>Show details</Menu.CheckboxItem>
                  <Menu.RadioGroup>
                    <Menu.RadioItem value="date">Sort by date</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.click(input);

    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(input).toHaveFocus();
    expect(handleItemClick).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('menuitem', { name: 'Open details' }));
    expect(input).toHaveFocus();

    const checkboxItem = screen.getByRole('menuitemcheckbox', { name: 'Show details' });
    await user.click(checkboxItem);
    expect(input).toHaveFocus();
    expect(checkboxItem).toHaveAttribute('aria-checked', 'true');

    const radioItem = screen.getByRole('menuitemradio', { name: 'Sort by date' });
    await user.click(radioItem);
    expect(input).toHaveFocus();
    expect(radioItem).toHaveAttribute('aria-checked', 'true');
  });

  describe('item text resolution', () => {
    it('matches text that a descendant rendered after the item registered', async () => {
      const label = shallowRef('Loading');
      const AsyncLabel = defineComponent(() => () => label.value);

      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      <AsyncLabel />
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      label.value = 'Rename';
      await flushMicrotasks();
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rename');

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    });

    it('stops matching text that a descendant no longer renders', async () => {
      const label = shallowRef('Rename');
      const AsyncLabel = defineComponent(() => () => label.value);

      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item data-testid="async-item">
                      <AsyncLabel />
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      label.value = '';
      await flushMicrotasks();
      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rename');

      await waitFor(() => {
        expect(screen.queryByTestId('async-item')).toBe(null);
      });
    });

    it('matches an item whose children are an array while it is filtered out', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      {'Re'}
                      {'name'}
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      // Hide it, so its DOM node goes away and only the children remain as a text source.
      await user.type(input, 'del');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });

      await fireEvent.input(input, { target: { value: 'rena' } });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      });
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });

    it('keeps the rendered text of a hidden item whose children render different text', async () => {
      const translations: Record<string, string> = { Rename: 'Zmień nazwę', Delete: 'Usuń' };
      const Translate = defineComponent({
        props: { text: { type: String, required: true } },
        setup: (props) => () => translations[props.text],
      });

      const Test = defineComponent({
        props: { value: { type: String, required: true }, tick: { type: Number, required: true } },
        setup: (props) => () => (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-tick={props.tick}>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>
                        <Translate text="Rename" />
                      </Menu.Item>
                      <Menu.Item>
                        <Translate text="Delete" />
                      </Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ),
      });

      const { setProps } = await render(<Test value="" tick={0} />);

      await setProps({ value: 'usu', tick: 0 });
      expect(screen.queryByRole('menuitem', { name: 'Zmień nazwę' })).toBe(null);

      // Re-render the hidden item with the same children.
      await setProps({ value: 'usu', tick: 1 });

      await setProps({ value: 'zmie', tick: 1 });
      expect(screen.getByRole('menuitem', { name: 'Zmień nazwę' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Usuń' })).toBe(null);
    });

    it('matches the new children of an item that changed while it was filtered out', async () => {
      const Test = defineComponent({
        props: {
          value: { type: String, required: true },
          label: { type: String, required: true },
        },
        setup: (props) => () => (
          <Menu.FilterProvider value={props.value}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>{props.label}</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ),
      });

      const { setProps } = await render(<Test value="" label="Rename" />);

      await setProps({ value: 'del', label: 'Rename' });
      await setProps({ value: 'del', label: 'Duplicate' });
      await setProps({ value: 'dup', label: 'Duplicate' });

      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    });

    const RenderElementTest = defineComponent({
      props: { value: { type: String, required: true }, name: { type: String, required: true } },
      setup: (props) => () => (
        <Menu.FilterProvider value={props.value}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item
                      v-slots={{
                        render: ({ props: itemProps }: { props: HTMLProps }) => (
                          <div {...itemProps}>{props.name}</div>
                        ),
                      }}
                    />
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    it('matches the updated text of an item rendered through its render element', async () => {
      const { setProps } = await render(<RenderElementTest value="" name="One" />);

      await setProps({ value: '', name: 'Two' });
      await setProps({ value: 'two', name: 'Two' });

      expect(screen.getByRole('menuitem', { name: 'Two' })).toBeInTheDocument();
    });

    it('matches a render element whose text changed while the item was filtered out', async () => {
      const { setProps } = await render(<RenderElementTest value="two" name="One" />);
      expect(screen.queryByRole('menuitem', { name: 'One' })).toBe(null);

      await setProps({ value: 'two', name: 'Two' });

      expect(screen.getByRole('menuitem', { name: 'Two' })).toBeInTheDocument();
    });
  });

  describe('disabled items', () => {
    const onDisabledClick = vi.fn();

    function DisabledItemMenu() {
      return (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item disabled onClick={onDisabledClick}>
                      Archive
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('keeps a disabled item reachable with the arrow keys', async () => {
      const { user } = await render(<DisabledItemMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown]');

      // Menus keep disabled items discoverable rather than skipping them.
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Archive' }).id,
      );
    });

    it('does not activate a highlighted disabled item with Enter', async () => {
      onDisabledClick.mockClear();
      const { user } = await render(<DisabledItemMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown][Enter]');

      expect(onDisabledClick).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeVisible();
    });
  });
});
