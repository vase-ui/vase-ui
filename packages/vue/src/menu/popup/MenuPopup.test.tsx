import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import { ToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';

const ToolbarProvider = defineComponent((_, { slots }) => {
  provide(ToolbarRootContext, {
    disabled: computed(() => false),
    orientation: computed(() => 'horizontal' as const),
  });
  return () => slots.default?.();
});

describe('<Menu.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Popup />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>{node}</Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('uses an aria-label instead of the trigger label', async () => {
    await render(
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup aria-label="Commands" />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const popup = screen.getByRole('menu', { name: 'Commands' });
    expect(popup).not.toHaveAttribute('aria-labelledby');
  });

  it('stops toolbar navigation keys without blocking ordinary key events', async () => {
    const onParentKeyDown = vi.fn();
    const container = shallowRef<HTMLElement | null>(null);
    const setContainer = (element: unknown) => {
      container.value = element as HTMLElement | null;
    };

    // The popup is in a container inside the element that listens, as in a toolbar. Vue sends an
    // event to the DOM parents only, so a popup in `<body>` would not reach the listener.
    await render(
      <ToolbarProvider>
        <div onKeydown={onParentKeyDown}>
          <div ref={setContainer} />
          <Menu.Root>
            <Menu.Portal keepMounted container={container}>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </ToolbarProvider>,
    );

    const popup = screen.getByTestId('popup');
    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }),
    );
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F1' }),
    );
    expect(onParentKeyDown).toHaveBeenCalled();
    expect(onParentKeyDown.mock.calls.every(([event]) => event.key === 'F1')).toBe(true);
  });

  describe('attributes', () => {
    it('has the menu role and the name of the trigger', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const popup = screen.getByRole('menu', { name: 'Actions' });
      expect(popup).toHaveAttribute('aria-labelledby', screen.getByRole('button').id);
      expect(popup).not.toHaveAttribute('aria-orientation');
    });

    it('gives an explicit aria-labelledby the place of the trigger label', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <span id="commands-label">Commands</span>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup aria-labelledby="commands-label" />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByRole('menu', { name: 'Commands' })).toHaveAttribute(
        'aria-labelledby',
        'commands-label',
      );
    });

    it('has the orientation of a horizontal menu', async () => {
      await render(
        <Menu.Root open orientation="horizontal">
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('has the state of the menu in its data attributes', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const popup = screen.getByRole('menu');
      expect(popup).toHaveAttribute('data-open');
      expect(popup).toHaveAttribute('data-side', 'bottom');
      expect(popup).toHaveAttribute('data-align', 'center');
      expect(popup).not.toHaveAttribute('data-nested');
    });

    it('names its root as the owner', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(probe.store.select('rootId')).toBeTruthy();
      expect(screen.getByRole('menu')).toHaveAttribute(
        'data-rootownerid',
        probe.store.select('rootId'),
      );
    });
  });

  describe('prop: id', () => {
    it('gives the id of the popup to the root and to the trigger, and gives the generated id back', async () => {
      const id = shallowRef<string | undefined>('custom-popup');
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root open>
          <probe.Probe />
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup id={id.value} />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const popup = screen.getByRole('menu');
      const trigger = screen.getByRole('button');
      expect(popup.id).toBe('custom-popup');
      expect(probe.store.select('popupId')).toBe('custom-popup');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup');

      id.value = undefined;
      await flushMicrotasks();

      expect(popup.id).toBe(probe.context.generatedPopupId);
      expect(probe.store.select('defaultPopupId')).toBe(probe.context.generatedPopupId);
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });

    it('takes back the id of a popup that unmounts', async () => {
      const mounted = shallowRef(true);
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>{mounted.value ? <Menu.Popup id="custom-popup" /> : null}</Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      expect(probe.store.select('defaultPopupId')).toBe('custom-popup');

      mounted.value = false;
      await flushMicrotasks();

      expect(probe.store.select('defaultPopupId')).toBe(probe.context.generatedPopupId);
    });
  });

  describe('events', () => {
    it('closes the menu for a close event of the tree', async () => {
      const onOpenChange = vi.fn();
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const domEvent = new MouseEvent('click');

      probe.store.select('floatingTreeRoot').events.emit('close', {
        domEvent,
        reason: REASONS.itemPress,
      });

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      expect(onOpenChange.mock.lastCall?.[1].event).toBe(domEvent);
    });

    it('reports the completion of the open one time', async () => {
      const onOpenChangeComplete = vi.fn();
      await render(
        <Menu.Root defaultOpen onOpenChangeComplete={onOpenChangeComplete}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledTimes(1);
      });
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside Menu.Positioner', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.Popup />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Popup> and <Menu.Arrow> must be inside <Menu.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Menu.Positioner>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
