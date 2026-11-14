import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  pressWithScreenReader,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

const Test = defineComponent({
  props: {
    submenuTriggerProps: { type: Object as PropType<Record<string, unknown>>, default: undefined },
  },
  setup(props) {
    return () => (
      <Menu.Root>
        <Menu.Trigger>Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" {...props.submenuTriggerProps}>
                  More
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                      <Menu.Item>Beta</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  },
});

async function fireScreenReaderMouseDown(element: Element) {
  await fireEvent.pointerDown(element, {
    pointerType: 'mouse',
    width: 1,
    height: 1,
    pressure: 0,
    detail: 0,
    buttons: 0,
  });
  await fireEvent.mouseDown(element, { detail: 0 });
}

async function waitForFrames(count = 2) {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await waitSingleFrame();
  }
}

// `isVirtualPointerEvent` returns `false` under jsdom, so the virtual press cannot be detected there.
describe.skipIf(isJSDOM)('<Menu.SubmenuTrigger /> with a screen reader press', () => {
  const { render } = createRenderer();

  it('toggles the submenu on repeated screen reader activation with the default `openOnHover`', async () => {
    const { user } = await render(<Test />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    await pressWithScreenReader(submenuTrigger);

    // Let opening focus settle before activating again.
    await screen.findByTestId('submenu');
    await waitForFrames();

    await pressWithScreenReader(submenuTrigger);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu')).toBe(null);
    });
    expect(screen.getByTestId('parent-menu')).not.toBe(null);
    await waitForFrames();

    await pressWithScreenReader(submenuTrigger);

    expect(await screen.findByTestId('submenu')).not.toBe(null);
    await waitForFrames();
    expect(screen.getByTestId('parent-menu')).not.toBe(null);
  });

  it('does not close the submenu on the trailing click of a screen reader press with `openOnHover={false}`', async () => {
    const { user } = await render(<Test submenuTriggerProps={{ openOnHover: false }} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    await fireScreenReaderMouseDown(submenuTrigger);

    await screen.findByTestId('submenu');

    // The trailing click must not toggle the freshly opened submenu closed.
    await fireEvent.click(submenuTrigger, { detail: 0 });
    await waitForFrames();

    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it('opens on a screen reader press without waiting a frame', async () => {
    const { user } = await render(<Test />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    await fireScreenReaderMouseDown(submenuTrigger);
    // The portal of the submenu renders its content in the flush after its own mount.
    await flushMicrotasks();

    // The reader re-syncs focus to its cursor right after the press, so the open cannot wait.
    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it('reports the trigger, not a pressed descendant, as the opener', async () => {
    const onOpenChange = vi.fn();
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.SubmenuRoot onOpenChange={onOpenChange}>
                <Menu.SubmenuTrigger data-testid="submenu-trigger">
                  More <span data-testid="icon">▸</span>
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    await pressWithScreenReader(screen.getByTestId('icon'));

    await screen.findByTestId('submenu');
    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ trigger: submenuTrigger }),
    );
  });

  it('ignores an ordinary mouse press with the default `openOnHover`', async () => {
    const { user } = await render(<Test />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    // A real mouse press has a pressed button even when it reports no pressure.
    await fireEvent.pointerDown(submenuTrigger, {
      pointerType: 'mouse',
      width: 1,
      height: 1,
      pressure: 0,
      detail: 0,
      buttons: 1,
    });
    await fireEvent.mouseDown(submenuTrigger);
    await fireEvent.click(submenuTrigger, { detail: 1 });

    await waitForFrames();

    expect(screen.queryByTestId('submenu')).toBe(null);
  });
});
