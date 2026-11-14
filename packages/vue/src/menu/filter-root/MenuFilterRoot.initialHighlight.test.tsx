import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  firePointer,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

const Test = defineComponent(
  (props: { openOnHover?: boolean; onInputFocus?: () => void }) => () => (
    <Menu.FilterProvider>
      <Menu.Root>
        <Menu.Trigger openOnHover={props.openOnHover} delay={0}>
          Actions
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" onFocus={props.onInputFocus} />
              <Menu.Empty>No actions found.</Menu.Empty>
              <Menu.List>
                <Menu.Item disabled>Unavailable</Menu.Item>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  { props: ['openOnHover', 'onInputFocus'] },
);

describe('filterable menu initial highlight', () => {
  const { render } = createRenderer();

  it.each([
    { key: 'ArrowDown', position: 'first', name: 'Rename' },
    { key: 'ArrowUp', position: 'last', name: 'Delete' },
  ])('highlights the $position enabled action when $key opens the menu', async ({ key, name }) => {
    const { user } = await render(<Test />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    await flushMicrotasks();
    await user.keyboard(`[${key}]`);

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    const item = screen.getByRole('menuitem', { name });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('aria-activedescendant', item.id);
  });

  // iOS VoiceOver presses with a touch whose contact is under a pixel and carries no pressure.
  async function pressLikeIOSVoiceOver(element: HTMLElement) {
    const init = { pointerType: 'touch', width: 0.333, height: 0.333, pressure: 0 };
    await firePointer.down(element, { ...init, timeStamp: 10 });
    await fireEvent.mouseDown(element, { detail: 1 });
    await firePointer.up(element, { ...init, timeStamp: 20 });
    await fireEvent.mouseUp(element, { detail: 1 });
    await fireEvent.click(element, { detail: 1 });
  }

  it.skipIf(isJSDOM)(
    'focuses a submenu input when a screen reader press opens the submenu',
    async () => {
      await render(
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger openOnHover={false}>Move to</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter destinations" />
                          <Menu.List>
                            <Menu.Item>Documents</Menu.Item>
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.FilterProvider>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await pressLikeIOSVoiceOver(screen.getByRole('menuitem', { name: 'Move to' }));

      const input = await screen.findByRole('searchbox', { name: 'Filter destinations' });
      await waitFor(() => expect(input).toHaveFocus());
    },
  );

  it('does not focus the input when opened on hover', async () => {
    const onInputFocus = vi.fn();
    const { user } = await render(<Test openOnHover onInputFocus={onInputFocus} />);

    await user.hover(screen.getByRole('button', { name: 'Actions' }));

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitSingleFrame();
    expect(input).not.toHaveFocus();
    expect(onInputFocus).not.toHaveBeenCalled();
  });

  it('does not highlight an item when a controlled open follows a keyboard open', async () => {
    const ControlledTest = defineComponent(
      (props: { open: boolean | undefined }) => {
        const open = shallowRef(false);

        return () => (
          <Menu.FilterProvider>
            <Menu.Root
              open={props.open ?? open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
            >
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      },
      { props: ['open'] },
    );

    const { user, setProps } = await render(<ControlledTest open={undefined} />);
    screen.getByRole('button', { name: 'Actions' }).focus();
    await flushMicrotasks();
    await user.keyboard('[ArrowDown]');
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
    });

    await setProps({ open: false });
    await waitFor(() => {
      expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
    });
    await setProps({ open: true });

    const reopenedInput = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitSingleFrame();
    expect(reopenedInput).not.toHaveAttribute('aria-activedescendant');
  });
});
