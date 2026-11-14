import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { REASONS } from '../../internals/reasons';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.List />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.List />, () => ({
    refInstanceof: window.HTMLUListElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));

  describe('arrow keys', () => {
    it('moves the focus between the links with ArrowRight and ArrowLeft, and does not loop', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#two">Two</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      const one = screen.getByRole('link', { name: 'One' });
      const two = screen.getByRole('link', { name: 'Two' });

      one.focus();
      await user.keyboard('[ArrowLeft]');
      expect(one).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(one).toHaveFocus();
    });

    it('moves the focus with ArrowDown and ArrowUp when the orientation is vertical', async () => {
      const { user } = await render(
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#two">Two</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      const one = screen.getByRole('link', { name: 'One' });
      const two = screen.getByRole('link', { name: 'Two' });

      one.focus();
      await user.keyboard('[ArrowRight]');
      expect(one).toHaveFocus();

      await user.keyboard('[ArrowDown]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowUp]');
      expect(one).toHaveFocus();
    });

    it.each([
      { name: 'ArrowRight', orientation: 'horizontal', key: 'ArrowRight' },
      { name: 'ArrowLeft', orientation: 'horizontal', key: 'ArrowLeft' },
      { name: 'ArrowDown', orientation: 'vertical', key: 'ArrowDown' },
      { name: 'ArrowUp', orientation: 'vertical', key: 'ArrowUp' },
    ] as const)(
      'stops $name at the list when the orientation is $orientation, also at the end of the list',
      async ({ orientation, key }) => {
        const handleKeyDown = vi.fn();

        await render(
          <div onKeydown={handleKeyDown}>
            <NavigationMenu.Root orientation={orientation}>
              <NavigationMenu.List>
                <NavigationMenu.Item>
                  <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Root>
          </div>,
        );
        const link = screen.getByRole('link', { name: 'One' });

        link.focus();
        await fireEvent.keyDown(link, { key });
        expect(handleKeyDown).not.toHaveBeenCalled();

        await fireEvent.keyDown(link, { key: 'PageDown' });
        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      },
    );

    it('lets the links of a nested list use the composite of the list above', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#before">Before</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Root>
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link href="#nested-one">Nested one</NavigationMenu.Link>
                  </NavigationMenu.Item>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link href="#nested-two">Nested two</NavigationMenu.Link>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#after">After</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      screen.getByRole('link', { name: 'Before' }).focus();
      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'Nested one' })).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'Nested two' })).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'After' })).toHaveFocus();
    });
  });

  it('stops vertical navigation keys from escaping the list', async () => {
    const handleKeyDown = vi.fn();

    await render(
      <div onKeydown={handleKeyDown}>
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List data-testid="list">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Item' });
    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(handleKeyDown.mock.calls.length).toBe(0);

    await fireEvent.keyDown(trigger, { key: 'PageDown' });

    expect(handleKeyDown.mock.calls.length).toBe(1);
  });

  describe('item removal', () => {
    const App = defineComponent({
      props: { showFirst: { type: Boolean, required: true } },
      setup(props) {
        return () => (
          <NavigationMenu.Root>
            <NavigationMenu.List>
              {props.showFirst && (
                <NavigationMenu.Item>
                  <NavigationMenu.Trigger data-testid="first">One</NavigationMenu.Trigger>
                </NavigationMenu.Item>
              )}
              <NavigationMenu.Item>
                <NavigationMenu.Trigger data-testid="middle">Two</NavigationMenu.Trigger>
              </NavigationMenu.Item>
              <NavigationMenu.Item>
                <NavigationMenu.Trigger data-testid="last">Three</NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
        );
      },
    });

    it('navigates from the focused trigger after an earlier item is removed', async () => {
      const { setProps } = await render(<App showFirst />);

      const first = screen.getByTestId('first');
      first.focus();

      await fireEvent.keyDown(first, { key: 'ArrowRight' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');
      await fireEvent.keyDown(middle, { key: 'ArrowRight' });
      await flushMicrotasks();

      const last = screen.getByTestId('last');
      expect(last).toHaveFocus();

      await setProps({ showFirst: false });

      await fireEvent.keyDown(last, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(middle).toHaveFocus();
    });
  });

  describe('dismissal', () => {
    const DismissMenu = defineComponent({
      props: {
        onValueChange: {
          type: Function as PropType<(value: unknown, details: { reason: string }) => void>,
          default: undefined,
        },
        stopKeydown: { type: Boolean, default: false },
      },
      setup(props) {
        return () => (
          <div onKeydown={props.stopKeydown ? (event) => event.stopPropagation() : undefined}>
            <NavigationMenu.Root onValueChange={props.onValueChange}>
              <NavigationMenu.List>
                <NavigationMenu.Item value="one">
                  <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="two">
                  <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#two">Link of two</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item>
                  <NavigationMenu.Link data-testid="top-link" href="#top">
                    Top
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Portal>
                <NavigationMenu.Positioner>
                  <NavigationMenu.Popup>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
            <button type="button" data-testid="outside">
              Outside
            </button>
          </div>
        );
      },
    });

    // A press with no hover and no focus. A real pointer hovers the trigger first, and the focus
    // of the trigger makes a press outside a focus-out.
    async function open(testId: string) {
      await fireEvent.click(screen.getByTestId(testId));
      await flushMicrotasks();
      expect(screen.getByTestId(testId)).toHaveAttribute('aria-expanded', 'true');
    }

    it('closes the menu with Escape and returns the focus to the active trigger', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<DismissMenu onValueChange={handleValueChange} />);
      await open('trigger-one');
      await open('trigger-two');
      handleValueChange.mockClear();

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger-two');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe(null);
      expect(handleValueChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('closes the menu with Escape on a trigger when an ancestor stops the event', async () => {
      await render(<DismissMenu stopKeydown />);
      await open('trigger-one');

      await fireEvent.keyDown(screen.getByTestId('trigger-one'), { key: 'Escape' });

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the menu for a press outside it', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(<DismissMenu onValueChange={handleValueChange} />);
      await open('trigger-one');
      handleValueChange.mockClear();

      await user.click(screen.getByTestId('outside'));
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('aria-expanded', 'false');
      expect(handleValueChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });

    it('keeps the menu open for a press of a trigger of another menu', async () => {
      await render(
        <div>
          <DismissMenu />
          <NavigationMenu.Root>
            <NavigationMenu.List>
              <NavigationMenu.Item value="other">
                <NavigationMenu.Trigger data-testid="other-trigger">Other</NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
        </div>,
      );
      await open('trigger-one');

      await fireEvent.click(screen.getByTestId('other-trigger'));
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the menu open for a press in the list', async () => {
      const { user } = await render(<DismissMenu />);
      await open('trigger-one');

      await user.click(screen.getByTestId('top-link'));
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not close the menu for Escape while KeepAlive holds it, and closes it after the activation', async () => {
      const visible = shallowRef(true);
      await render(() => <KeepAlive>{visible.value ? <DismissMenu /> : null}</KeepAlive>);
      await open('trigger-one');
      const trigger = screen.getByTestId('trigger-one');

      visible.value = false;
      await flushMicrotasks();
      await fireEvent.keyDown(document.body, { key: 'Escape' });

      visible.value = true;
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('hover of the popup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function HoverMenu() {
      return (
        <NavigationMenu.Root closeDelay={100}>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner data-testid="positioner">
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      );
    }

    it('closes the menu for the close delay of the root after the pointer leaves the popup', async () => {
      await render(<HoverMenu />);
      const trigger = screen.getByTestId('trigger');
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(50);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // The trigger gets no leave event. Its safe polygon, which has the close delay of the
      // trigger, thus does not handle the leave of the popup.
      const positioner = screen.getByTestId('positioner');
      await fireEvent.mouseEnter(positioner);
      await fireEvent.mouseLeave(positioner);
      vi.advanceTimersByTime(99);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <NavigationMenu.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<NavigationMenu.List />)).rejects.toThrow(
        'Vase UI: <NavigationMenu.Root> is missing. A Navigation Menu part reads the open item from its root. Put the part inside <NavigationMenu.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
