import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef, watch } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

describe('<Collapsible.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Collapsible.Root />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('ARIA attributes', () => {
    it('sets ARIA attributes', async () => {
      await render(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-expanded');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      await render(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel id="custom-panel-id" data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });

    it('unregisters and restores the generated panel id when the panel remounts', async () => {
      function App({ panelMounted }: { panelMounted: boolean }) {
        return (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger />
            {panelMounted && <Collapsible.Panel data-testid="panel" />}
          </Collapsible.Root>
        );
      }

      const { rerender } = await render(<App panelMounted />);
      const trigger = screen.getByRole('button');

      await rerender(<App panelMounted={false} />);
      expect(trigger).not.toHaveAttribute('aria-controls');

      await rerender(<App panelMounted />);
      expect(trigger).toHaveAttribute('aria-controls', screen.getByTestId('panel').id);
    });

    it('follows a change of the panel id', async () => {
      function App({ panelId }: { panelId: string | undefined }) {
        return (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger />
            <Collapsible.Panel id={panelId} data-testid="panel" />
          </Collapsible.Root>
        );
      }

      const { rerender } = await render(<App panelId="first-panel-id" />);
      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-controls', 'first-panel-id');

      await rerender(<App panelId="second-panel-id" />);
      expect(trigger).toHaveAttribute('aria-controls', 'second-panel-id');
      expect(panel).toHaveAttribute('id', 'second-panel-id');

      await rerender(<App panelId={undefined} />);
      expect(panel.id).not.toBe('');
      expect(panel.id).not.toBe('second-panel-id');
      expect(trigger).toHaveAttribute('aria-controls', panel.id);
    });
  });

  describe('collapsible status', () => {
    it('disabled status', async () => {
      await render(
        <Collapsible.Root disabled>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('data-disabled');
    });

    it('does not toggle or call onOpenChange when clicked while disabled', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root disabled onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('BaseUIChangeEventDetails', () => {
    it('calls onOpenChange with eventDetails', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      const [openArg, details] = handleOpenChange.mock.calls[0] as [boolean, any];
      expect(openArg).toBe(true);
      expect(details).not.toBe(undefined);
      expect(details.reason).toBe(REASONS.triggerPress);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.isCanceled).toBe(false);
      expect(typeof details.cancel).toBe('function');
      expect(typeof details.allowPropagation).toBe('function');
    });

    it('eventDetails.cancel() prevents opening while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      const { user } = await render(
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('eventDetails.cancel() prevents closing while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      const { user } = await render(
        <Collapsible.Root defaultOpen onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('open state', () => {
    it('controlled trigger presses request open and close state changes', async () => {
      const App = defineComponent(() => {
        const open = shallowRef(false);
        return () => (
          <Collapsible.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
          >
            <Collapsible.Trigger>trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('does not change controlled open state without an external update', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root open={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'trigger' });

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('controlled mode', async () => {
      const App = defineComponent(() => {
        const open = shallowRef(false);
        return () => (
          <>
            <Collapsible.Root open={open.value}>
              <Collapsible.Trigger>trigger</Collapsible.Trigger>
              <Collapsible.Panel>This is panel content</Collapsible.Panel>
            </Collapsible.Root>
            <button
              type="button"
              onClick={() => {
                open.value = !open.value;
              }}
            >
              toggle
            </button>
          </>
        );
      });
      const { user } = await render(<App />);

      const externalTrigger = screen.getByRole('button', { name: 'toggle' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(externalTrigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');

      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.click(externalTrigger);

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('uncontrolled mode', async () => {
      const { user } = await render(
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger />
          <Collapsible.Panel>This is panel content</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('state callbacks', () => {
    it('passes state to className and style callbacks', async () => {
      const { user } = await render(
        <Collapsible.Root
          data-testid="root"
          stateClass={(state) => (state.open ? 'root-open' : 'root-closed')}
          stateStyle={(state) => ({ opacity: state.open ? 1 : 0.5 })}
        >
          <Collapsible.Trigger
            stateClass={(state) => (state.open ? 'trigger-open' : 'trigger-closed')}
            stateStyle={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            Trigger
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            data-testid="panel"
            stateClass={(state) => (state.open ? 'panel-open' : 'panel-closed')}
            stateStyle={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const root = screen.getByTestId('root');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(root).toHaveClass('root-closed');
      expect(root).toHaveStyle({ opacity: '0.5' });
      expect(trigger).toHaveClass('trigger-closed');
      expect(trigger).toHaveStyle({ opacity: '0.5' });
      expect(panel).toHaveClass('panel-closed');
      expect(panel).toHaveStyle({ opacity: '0.5' });

      await user.click(trigger);

      expect(root).toHaveClass('root-open');
      expect(root).toHaveStyle({ opacity: '1' });
      expect(trigger).toHaveClass('trigger-open');
      expect(trigger).toHaveStyle({ opacity: '1' });
      expect(panel).toHaveClass('panel-open');
      expect(panel).toHaveStyle({ opacity: '1' });
    });
  });

  describe.skipIf(isJSDOM)('keyboard interactions', () => {
    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key does not toggle or call onOpenChange when disabled',
      async ({ key }) => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <Collapsible.Root disabled onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>,
        );

        const trigger = screen.getByRole('button');

        await user.keyboard('[Tab]');
        expect(trigger).not.toHaveFocus();

        await user.keyboard(`[${key}]`);

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      },
    );

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key should toggle the Collapsible',
      async ({ key }) => {
        const { user } = await render(
          <Collapsible.Root defaultOpen={false}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>This is panel content</Collapsible.Panel>
          </Collapsible.Root>,
        );

        const trigger = screen.getByRole('button');

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        await user.keyboard(`[${key}]`);

        expect(trigger).toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');

        await user.keyboard(`[${key}]`);

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).not.toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      },
    );
  });

  describe('v-model:open', () => {
    // The sync watcher logs each write of the parent value, so `calls` shows the order of the two
    // events.
    function createModelApp(
      calls: string[],
      model: { value: boolean },
      handleOpenChange: (open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => void,
      hiddenUntilFound = false,
    ) {
      return defineComponent(() => {
        watch(
          () => model.value,
          (value) => {
            calls.push(`update:open ${value}`);
          },
          { flush: 'sync' },
        );

        return () => (
          <Collapsible.Root
            v-model:open={model.value}
            onOpenChange={(
              nextOpen: boolean,
              eventDetails: Collapsible.Root.ChangeEventDetails,
            ) => {
              calls.push(`openChange ${nextOpen} ${eventDetails.reason}`);
              handleOpenChange(nextOpen, eventDetails);
            }}
          >
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel hiddenUntilFound={hiddenUntilFound} data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        );
      });
    }

    it('emits openChange and then update:open, and the parent value follows in each direction', async () => {
      const calls: string[] = [];
      const model = shallowRef(false);
      const App = createModelApp(calls, model, () => {});

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      expect(calls).toEqual(['openChange true trigger-press', 'update:open true']);
      expect(model.value).toBe(true);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);

      expect(calls.slice(2)).toEqual(['openChange false trigger-press', 'update:open false']);
      expect(model.value).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      model.value = true;
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('data-open');
    });

    it('emits no update:open and keeps the parent value when a listener cancels the change', async () => {
      const calls: string[] = [];
      const model = shallowRef(false);
      const App = createModelApp(calls, model, (nextOpen, eventDetails) => {
        eventDetails.cancel();
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      expect(calls).toEqual(['openChange true trigger-press']);
      expect(model.value).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('emits openChange and then update:open for a beforematch open of a hiddenUntilFound panel', async () => {
      const calls: string[] = [];
      const model = shallowRef(false);
      const App = createModelApp(calls, model, () => {}, true);

      await render(<App />);
      const panel = screen.getByTestId('panel');

      await fireEvent(panel, new window.Event('beforematch', { bubbles: true }));

      expect(calls).toEqual(['openChange true none', 'update:open true']);
      expect(model.value).toBe(true);
      expect(panel).toHaveAttribute('data-open');
    });
  });

  describe('accessibility', () => {
    it.each([
      { name: 'open', defaultOpen: true },
      { name: 'closed', defaultOpen: false },
    ])('has no axe violation when the collapsible is $name', async ({ defaultOpen }) => {
      const { container } = await render(
        <Collapsible.Root defaultOpen={defaultOpen}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      await expectNoAxeViolations(container);
    });
  });
});
