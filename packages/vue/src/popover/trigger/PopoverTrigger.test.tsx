import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, shallowRef } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  enterWithMouse,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { createAttribute } from '../../utils/popups/createAttribute';
import * as Popover from '../index.parts';
import PopoverTriggerScoped from './PopoverTriggerScoped.test.vue';

async function press(element: HTMLElement) {
  await fireEvent.pointerDown(element, { pointerType: 'mouse' });
  await fireEvent.click(element, { detail: 1 });
}

describe('<Popover.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(<Popover.Root open>{node}</Popover.Root>);
    },
  }));

  it('has the attributes of a dialog trigger', async () => {
    await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('data-vase-ui-click-trigger');
  });

  it('takes its id prop as the trigger id', async () => {
    await render(
      <Popover.Root open triggerId="mine">
        <Popover.Trigger id="other">Other</Popover.Trigger>
        <Popover.Trigger id="mine">Mine</Popover.Trigger>
      </Popover.Root>,
    );

    const other = screen.getByRole('button', { name: 'Other' });
    const mine = screen.getByRole('button', { name: 'Mine' });
    expect(mine).toHaveAttribute('id', 'mine');
    expect(mine).toHaveAttribute('aria-expanded', 'true');
    expect(other).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes with a press and has data-pressed while a press opened it', async () => {
    const handle = Popover.createHandle<unknown>();
    await render(
      <Popover.Root handle={handle}>
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).not.toHaveAttribute('data-pressed');

    await press(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(trigger).toHaveAttribute('data-pressed');
    expect(handle.store.state.openMethod).toBe('mouse');

    await press(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(trigger).not.toHaveAttribute('data-pressed');
  });

  it('has data-popup-open and no data-pressed when code opens the popover', async () => {
    await render(
      <Popover.Root defaultOpen defaultTriggerId="trigger">
        <Popover.Trigger id="trigger">Open</Popover.Trigger>
      </Popover.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(trigger).not.toHaveAttribute('data-pressed');
  });

  it('takes a toolbar button as its as prop', async () => {
    await render(
      <Toolbar.Root>
        <Popover.Root>
          <Popover.Trigger as={Toolbar.Button}>Trigger as button</Popover.Trigger>
        </Popover.Root>
      </Toolbar.Root>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Trigger as button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-orientation', 'horizontal');
    expect(button).toHaveAttribute('tabindex', '0');
  });

  describe('prop: delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { name: 'the default delay', delay: undefined, wait: 300 },
      { name: 'a delay of 100 ms', delay: 100, wait: 100 },
    ])('opens on hover after $name', async ({ delay, wait }) => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={delay}>
            Open
          </Popover.Trigger>
        </Popover.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(wait - 1);
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('data-popup-open');
    });
  });

  describe('prop: disabled', () => {
    it('disables the popover', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.click(trigger);
      await flushMicrotasks();
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('custom element', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled as="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.click(trigger);
      await flushMicrotasks();
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('does not open on hover when disabled', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled openOnHover delay={0} as="span" nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.hover(trigger);
      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('openOnHover opened by touch', () => {
    function MultiTriggerPopover() {
      return (
        <Popover.Root
          v-slots={{
            default: ({ payload }: { payload: unknown }) => (
              <>
                <Popover.Trigger
                  payload="One"
                  openOnHover
                  delay={0}
                  closeDelay={0}
                  style={{ pointerEvents: 'none' }}
                >
                  One
                </Popover.Trigger>
                <Popover.Trigger
                  payload="Two"
                  openOnHover
                  delay={0}
                  closeDelay={0}
                  style={{ pointerEvents: 'none' }}
                >
                  Two
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <span data-testid="content">{payload as string}</span>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </>
            ),
          }}
        />
      );
    }

    async function pressTrigger(trigger: HTMLElement, pointerType: 'mouse' | 'touch') {
      // The three events come in one task, before Vue renders.
      await Promise.all([
        fireEvent.pointerDown(trigger, { pointerType }),
        fireEvent.mouseDown(trigger),
        fireEvent.click(trigger, { detail: 1 }),
      ]);
    }

    async function hoverTrigger(trigger: HTMLElement) {
      await enterWithMouse(trigger);
    }

    // A touch tap leaves the pointer parked wherever the cursor happens to be, so hover must stay
    // disarmed until the popover is reopened by some other means. Otherwise a stray hover over a
    // sibling trigger silently swaps the content the user just tapped for.
    it('keeps ownership on the tapped trigger when a sibling trigger is hovered', async () => {
      await render(<MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'touch');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      await hoverTrigger(two);
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('One');
      expect(two).toHaveAttribute('aria-expanded', 'false');
    });

    // The same hover must still take over when the popover was opened with a mouse, so the guard
    // above can't be a blanket disable.
    it('hands ownership to a hovered sibling trigger when opened by mouse', async () => {
      await render(<MultiTriggerPopover />);

      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });

      await pressTrigger(one, 'mouse');

      expect(screen.getByTestId('content')).toHaveTextContent('One');

      await hoverTrigger(two);
      await flushMicrotasks();

      expect(screen.getByTestId('content')).toHaveTextContent('Two');
      expect(two).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open by clicking', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger />
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      trigger.click();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('should have the data-popup-open but not the data-pressed attribute when open by hover', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).not.toHaveAttribute('data-pressed');
    });

    it('should not have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true` and `delay=0`', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      trigger.click();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true`', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      trigger.click();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('closes the popover if the user clicks patiently', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);
      await flushMicrotasks();

      await fireEvent.click(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');

      // Leaving the trigger afterwards doesn't reopen it.
      await fireEvent.mouseLeave(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);

      // The hover opened the popover, so the click below lands on an open popover.
      expect(trigger).toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD - 1);
      await flushMicrotasks();

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      // User clicks impatiently to open
      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should keep the popover open when re-hovered and clicked within the patient threshold', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={100}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.toBe(null);

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);
      await flushMicrotasks();

      await fireEvent.mouseLeave(trigger);
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await fireEvent.click(trigger);
      expect(screen.getByText('Content')).not.toBe(null);
    });
  });

  describe('opened by hover', () => {
    async function renderOpenedByHover(tabindex?: number) {
      await render(
        <div>
          <button data-testid="before">Before</button>
          <Popover.Root>
            <Popover.Trigger openOnHover delay={0} tabindex={tabindex}>
              Toggle
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  <button>Inside</button>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <button data-testid="after">After</button>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.hover(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      return { trigger, user: userEvent };
    }

    it.each([
      { direction: 'forward', destination: 'after' },
      { direction: 'backward', destination: 'before' },
    ])('tabs $direction from the trigger in native order', async ({ direction, destination }) => {
      const { trigger, user } = await renderOpenedByHover();
      trigger.focus();
      await flushMicrotasks();
      expect(trigger).toHaveFocus();

      await user.tab({ shift: direction === 'backward' });

      expect(screen.getByTestId(destination)).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it.each([
      { tabindex: 0, result: 'onto the trigger' },
      { tabindex: -1, result: 'past an untabbable trigger' },
    ])('tabs $result', async ({ tabindex }) => {
      const { trigger, user } = await renderOpenedByHover(tabindex);
      screen.getByTestId('before').focus();
      await flushMicrotasks();

      await user.tab();

      expect(tabindex === 0 ? trigger : screen.getByTestId('after')).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('should toggle closed with Enter or Space when rendering a <div>', async () => {
    await render(
      <div>
        <Popover.Root>
          <Popover.Trigger as="div" nativeButton={false} data-testid="div-trigger">
            Toggle
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <button data-testid="other-button">Other button</button>
      </div>,
    );

    const trigger = screen.getByTestId('div-trigger');

    trigger.focus();
    await flushMicrotasks();
    await userEvent.keyboard('[Enter]');
    expect(screen.queryByText('Content')).not.toBe(null);
    // The initial focus moves in the frame after the open.
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard('[Enter]');
    await waitFor(() => {
      expect(screen.queryByText('Content')).toBe(null);
    });

    await userEvent.keyboard('[Enter]');
    expect(screen.queryByText('Content')).not.toBe(null);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard('[Space]');
    expect(screen.queryByText('Content')).toBe(null);

    await userEvent.keyboard('[Space]');
    expect(screen.queryByText('Content')).not.toBe(null);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard('[Space]');
    expect(screen.queryByText('Content')).toBe(null);
  });

  describe('VUE-60: the trigger has one root node', () => {
    it.each([
      { name: 'a closed popover', open: false, modal: false, guards: false },
      { name: 'an open popover', open: true, modal: false, guards: true },
      { name: 'an open modal popover', open: true, modal: true, guards: false },
    ])(
      'gives the scope id, v-show and a custom directive of the consumer to the trigger of $name',
      async ({ open, modal, guards }) => {
        const shown = shallowRef(true);
        await render(() => <PopoverTriggerScoped open={open} modal={modal} shown={shown.value} />);
        await flushMicrotasks();
        const trigger = screen.getByTestId('trigger');

        expect(getComputedStyle(trigger).outlineStyle).toBe('dashed');
        expect(trigger).toHaveAttribute('data-mark', 'marked');
        // The guards of the trigger are its siblings. A modal popover with a close part traps the
        // focus, so its trigger has no guards. The portal has guards of its own in its place.
        expect(
          [trigger.previousElementSibling, trigger.nextElementSibling].map(
            (sibling) => sibling?.hasAttribute(createAttribute('focus-guard')) ?? false,
          ),
        ).toEqual([guards, guards]);

        shown.value = false;
        await nextTick();

        expect(trigger).not.toBeVisible();
      },
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered without a root or a handle', async () => {
    await expect(render(<Popover.Trigger>Toggle</Popover.Trigger>)).rejects.toThrow(
      'Vase UI: <Popover.Trigger> must be inside <Popover.Root>, or it must have a `handle`. Without a root the trigger has no popover to open. Put the trigger inside <Popover.Root>, or pass a `handle`.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
