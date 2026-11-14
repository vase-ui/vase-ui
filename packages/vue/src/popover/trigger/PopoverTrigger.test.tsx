import { describe, expect, it } from 'vitest';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as Popover from '../index.parts';

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
