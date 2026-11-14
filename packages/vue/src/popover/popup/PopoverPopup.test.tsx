import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  popupFocusPropsTests,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import PopoverPopupReplace from './PopoverPopupReplace.test.vue';

describe('<Popover.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>{node}</Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('should render the children', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  popupFocusPropsTests({
    render,
    createComponent: ({ children, ...focusProps }) => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup {...focusProps}>
              {children}
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });

  it('focuses the popup when the active element becomes display:none', async () => {
    const TestComponent = defineComponent(() => {
      const hidden = shallowRef(false);
      return () => (
        <Popover.Root open>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">
                <button
                  data-testid="hide-button"
                  style={{ display: hidden.value ? 'none' : undefined }}
                  onClick={() => (hidden.value = true)}
                >
                  Hide
                </button>
                <input />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    });

    const { user } = await render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('hide-button')).toHaveFocus();
    });

    await user.click(screen.getByTestId('hide-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
  });

  describe('openOnHover: delay + click', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns focus to the trigger if opened by click before the hover delay completes', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByText('Open');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByText('Close')).not.toBe(null);

      vi.advanceTimersByTime(1000);
      await flushMicrotasks();

      await fireEvent.click(screen.getByText('Close'));
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
    });
  });

  describe('inside a toolbar', () => {
    const ToolbarPopover = defineComponent((_props, { slots }) => {
      return (): VNodeChild => (
        <Toolbar.Root>
          <Toolbar.Button>First</Toolbar.Button>
          <Popover.Root>
            <Popover.Trigger as={Toolbar.Button}>Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>{slots.default?.()}</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Toolbar.Button>Last</Toolbar.Button>
        </Toolbar.Root>
      );
    });

    it('does not relay composite keys from the popup to the toolbar', async () => {
      const { user } = await render(
        <ToolbarPopover>
          <button type="button">Inside</button>
        </ToolbarPopover>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('button', { name: 'Open' });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      const insideButton = screen.getByRole('button', { name: 'Inside' });
      await waitFor(() => {
        expect(insideButton).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await flushMicrotasks();

      expect(insideButton).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });

    it('keeps composite keys working inside the popup content', async () => {
      const { user } = await render(
        <ToolbarPopover>
          <input value="ab" />
        </ToolbarPopover>,
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      input.setSelectionRange(0, 0);
      await flushMicrotasks();

      await user.keyboard('[ArrowRight]');

      expect(input.selectionStart).toBe(1);
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });
  });

  it('has the attributes of a dialog that the trigger controls', async () => {
    await render(
      <Popover.Root defaultOpen defaultTriggerId="trigger">
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup).toHaveAttribute('tabindex', '-1');
    expect(popup).toHaveAttribute('data-vase-ui-focusable');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'bottom');
    expect(popup).toHaveAttribute('data-align', 'center');
    expect(popup.id).not.toBe('');
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-controls',
      popup.id,
    );
  });

  it.each<{ name: string; modal: boolean | 'trap-focus'; expected: boolean }>([
    { name: 'modal', modal: true, expected: true },
    { name: 'trap-focus', modal: 'trap-focus', expected: true },
    { name: 'not modal', modal: false, expected: false },
  ])(
    'writes focusManagerModal while the popup has a close part: $name',
    async ({ modal, expected }) => {
      const handle = Popover.createHandle<unknown>();
      const hasClose = shallowRef(true);
      await render(() => (
        <Popover.Root defaultOpen modal={modal} handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                {hasClose.value ? <Popover.Close>Close</Popover.Close> : null}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      await flushMicrotasks();
      expect(handle.store.state.focusManagerModal).toBe(expected);

      hasClose.value = false;
      await flushMicrotasks();

      expect(handle.store.state.focusManagerModal).toBe(false);
    },
  );

  // The compiled template of the fixture mounts the new popup before it unmounts the old popup. A
  // render function in TSX reuses the popup component, so it does not show this order.
  it('writes focusManagerModal for a new popup that replaces the old popup', async () => {
    const handle = Popover.createHandle<unknown>();
    const swapped = shallowRef(false);
    await render(() => (
      <Popover.Root defaultOpen modal handle={handle}>
        <Popover.Portal>
          <Popover.Positioner>
            <PopoverPopupReplace swapped={swapped.value} />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await screen.findByTestId('old');
    await flushMicrotasks();
    expect(handle.store.state.focusManagerModal).toBe(true);

    swapped.value = true;
    await flushMicrotasks();

    expect(screen.queryByTestId('old')).toBe(null);
    expect(handle.store.state.focusManagerModal).toBe(false);
  });

  it('stops a composite key in a toolbar that holds the portal container', async () => {
    const container = shallowRef<HTMLElement | null>(null);
    const { user } = await render(() => (
      <Toolbar.Root>
        <Toolbar.Button>First</Toolbar.Button>
        <Popover.Root defaultOpen>
          <Popover.Trigger as={Toolbar.Button}>Open</Popover.Trigger>
          <Popover.Portal container={container}>
            <Popover.Positioner>
              <Popover.Popup>
                <button type="button">Inside</button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Toolbar.Button>Last</Toolbar.Button>
        <div ref={(element) => (container.value = element as HTMLElement | null)} />
      </Toolbar.Root>
    ));
    await flushMicrotasks();
    const insideButton = screen.getByRole('button', { name: 'Inside' });
    expect(screen.getByRole('toolbar').contains(insideButton)).toBe(true);

    insideButton.focus();
    await user.keyboard('[ArrowRight]');
    await flushMicrotasks();

    expect(insideButton).toHaveFocus();
  });

  it('has no transition while it starts', async () => {
    // The start lasts one frame, so an observer records the popup when the portal adds it.
    const starts: Array<{ isStarting: boolean; transition: string }> = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const popup = (node as Element).querySelector?.<HTMLElement>('[data-testid="popup"]');
          if (popup) {
            starts.push({
              isStarting: popup.hasAttribute('data-starting-style'),
              transition: popup.style.transition,
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    onTestFinished(() => observer.disconnect());

    const open = shallowRef(false);
    await render(() => (
      <Popover.Root open={open.value}>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    open.value = true;
    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-open');
    });
    await waitFor(() => {
      expect(popup.style.transition).toBe('');
    });

    expect(starts).toEqual([{ isStarting: true, transition: 'none' }]);
  });

  it('keeps the element of a new popup that replaces the old popup, so a close completes', async () => {
    const swapped = shallowRef(false);
    const { user } = await render(() => (
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <PopoverPopupReplace swapped={swapped.value} />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await screen.findByTestId('old');

    swapped.value = true;
    await flushMicrotasks();
    expect(screen.queryByTestId('old')).toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('new')).toBe(null);
    });
  });

  it('throws a descriptive error when rendered outside <Popover.Positioner>', async () => {
    await expect(
      render(
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Popup />
          </Popover.Portal>
        </Popover.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup or an arrow of Popover must be inside <Popover.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later slot then
  // gives a warning. The case that renders no slot thus comes last.
  it('throws a descriptive error when rendered outside <Popover.Root>', async () => {
    await expect(render(<Popover.Popup />)).rejects.toThrow(
      'Vase UI: A part of Popover must be inside <Popover.Root>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
