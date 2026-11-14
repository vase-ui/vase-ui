import { vi, expect, describe, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import TooltipDefaultOpenHydration from './TooltipDefaultOpenHydration.test.vue';
import TooltipDetachedTrigger from './TooltipDetachedTrigger.test.vue';
import TooltipOwnershipHydration from './TooltipOwnershipHydration.test.vue';

type Details = Tooltip.Root.ChangeEventDetails;

async function insertServerHtml(file: string) {
  const container = document.createElement('div');
  container.innerHTML = await renderOnServer(file, {});
  document.body.append(container);
  return container;
}

describe('<Tooltip.Root />', () => {
  const { render } = createRenderer();

  it('keeps a default-open root open until its detached trigger hydrates', async () => {
    const handle = Tooltip.createHandle();
    let resume: (() => void) | undefined;
    const hydrationGate = new Promise<void>((resolve) => {
      resume = resolve;
    });

    const container = await insertServerHtml(
      'src/tooltip/root/TooltipDefaultOpenHydration.test.vue',
    );
    const trigger = within(container).getByRole('button', { name: 'Trigger' });
    expect(trigger).not.toHaveAttribute('data-popup-open');

    const app = createSSRApp(TooltipDefaultOpenHydration, { handle, hydrationGate });
    onTestFinished(() => {
      app.unmount();
      container.remove();
    });
    app.mount(container);

    await waitFor(() => {
      expect(handle.isOpen).toBe(true);
    });
    await flushMicrotasks();
    expect(handle.isOpen).toBe(true);

    resume?.();
    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-popup-open');
    });
    expect(takeReportedMessages()).toEqual([]);
  });

  it('keeps an open root open when ownership moves to a trigger that has not hydrated', async () => {
    const handle = Tooltip.createHandle();
    const onOpenChange = vi.fn();

    const container = await insertServerHtml('src/tooltip/root/TooltipOwnershipHydration.test.vue');
    const triggerBContainer = await insertServerHtml(
      'src/tooltip/root/TooltipDetachedTrigger.test.vue',
    );

    const app = createSSRApp(TooltipOwnershipHydration, { handle, onOpenChange });
    const triggerBApp = createSSRApp(TooltipDetachedTrigger, { handle });
    onTestFinished(() => {
      triggerBApp.unmount();
      triggerBContainer.remove();
      app.unmount();
      container.remove();
    });
    app.mount(container);

    await waitFor(() => {
      expect(handle.isOpen).toBe(true);
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Switch to B' }));
    await flushMicrotasks();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(handle.isOpen).toBe(true);

    triggerBApp.mount(triggerBContainer);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trigger B' })).toHaveAttribute('data-popup-open');
    });
    expect(takeReportedMessages()).toEqual([]);
  });

  detachedTriggersConformanceTests({
    render,
    createHandle: Tooltip.createHandle,
    Root: Tooltip.Root,
    Trigger: Tooltip.Trigger,
    Portal: Tooltip.Portal,
    Positioner: Tooltip.Positioner,
    Popup: Tooltip.Popup,
    Viewport: Tooltip.Viewport,
    triggerProps: { delay: 0 },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderTooltip() {
      const handle = Tooltip.createHandle();
      const bystander = { renders: 0 };

      await render(
        <div>
          <Tooltip.Trigger handle={handle} id="trigger-1" delay={0} closeDelay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="trigger-2" delay={0} closeDelay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={handle}
            id="trigger-3"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                bystander.renders += 1;
                return <button {...props}>Trigger 3</button>;
              },
            }}
          />
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
    }

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).not.toHaveAttribute('data-popup-open');
    }

    it('when opened and closed imperatively', async () => {
      const { handle, bystander, trigger1 } = await renderTooltip();

      async function openAndClose() {
        handle.open('trigger-1');
        await flushMicrotasks();
        await expectOpenedBy(trigger1);
        handle.close();
        await flushMicrotasks();
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = await renderTooltip();

      handle.open('trigger-1');
      await flushMicrotasks();
      await expectOpenedBy(trigger1);
      handle.open('trigger-2');
      await flushMicrotasks();
      await expectOpenedBy(trigger2);
      expect(trigger1).not.toHaveAttribute('data-popup-open');
      handle.close();
      await flushMicrotasks();
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });

    it('when focus opens and closes the popup', async () => {
      const { bystander, trigger1 } = await renderTooltip();

      async function openAndClose() {
        trigger1.focus();
        await flushMicrotasks();
        await expectOpenedBy(trigger1);
        trigger1.blur();
        await flushMicrotasks();
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when hover opens and closes the popup', async () => {
      const { bystander, trigger1, trigger2 } = await renderTooltip();

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      await expectOpenedBy(trigger1);
      await fireEvent.mouseLeave(trigger1);
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await expectOpenedBy(trigger2);
      await fireEvent.mouseLeave(trigger2);
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  it('closes a cursor-tracking tooltip when an inactive trigger is pressed', async () => {
    const handle = Tooltip.createHandle();

    await render(
      <div>
        <Tooltip.Trigger handle={handle} id="trigger-1">
          Trigger 1
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="trigger-2">
          Trigger 2
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} trackCursorAxis="both">
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>,
    );

    handle.open('trigger-1');
    await flushMicrotasks();
    expect(await screen.findByTestId('popup')).not.toBe(null);

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    await fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
    await fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('handle-backed root ownership', () => {
    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = Tooltip.createHandle();
      const onOpenChange = vi.fn();

      await render(
        <>
          <Tooltip.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={onOpenChange}
          >
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="default-open-content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Trigger handle={handle} id="trigger">
            Trigger
          </Tooltip.Trigger>
        </>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-popup-open');
      });

      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('default-open-content')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('hands off open state and payload to a trigger with its own DOM id while open', async () => {
      await render(
        <Tooltip.Root>
          {{
            default: ({ payload }: NumberPayload) => (
              <>
                <Tooltip.Trigger payload={1} delay={0} closeDelay={0}>
                  Trigger 1
                </Tooltip.Trigger>
                <Tooltip.Trigger
                  payload={2}
                  delay={0}
                  closeDelay={0}
                  v-slots={{
                    render: ({ props }: { props: HTMLProps }) => (
                      <button {...props} id="custom-button" type="button">
                        Trigger 2
                      </button>
                    ),
                  }}
                />

                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup>
                      <span data-testid="content">{payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </>
            ),
          }}
        </Tooltip.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Focus handoff keeps the popup open across the switch, so `open`/`triggerCount` do not change.
      trigger1.focus();
      await flushMicrotasks();
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      trigger2.focus();
      await flushMicrotasks();
      await flushMicrotasks();
      expect(trigger2).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    async function renderTwoTriggers(onOpenChange?: (open: boolean, details: Details) => void) {
      const showFirstTrigger = shallowRef(true);

      const Test = defineComponent(() => () => (
        <div style={{ padding: '50px' }}>
          <Tooltip.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
            {{
              default: ({ payload }: NumberPayload) => (
                <>
                  <div style={{ display: 'flex', gap: '120px' }}>
                    {showFirstTrigger.value && (
                      <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </Tooltip.Trigger>
                    )}
                    <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </Tooltip.Trigger>
                  </div>

                  <Tooltip.Portal>
                    <Tooltip.Positioner side="bottom" align="start">
                      <Tooltip.Popup>
                        <span data-testid="content">{payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              ),
            }}
          </Tooltip.Root>
        </div>
      ));

      await render(<Test />);
      return function removeFirstTrigger() {
        showFirstTrigger.value = false;
      };
    }

    it('should close when the active trigger unmounts', async () => {
      const removeFirstTrigger = await renderTwoTriggers();

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      removeFirstTrigger();
      await flushMicrotasks();

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const onOpenChange = vi.fn((nextOpen: boolean, details: Details) => {
        if (!nextOpen) {
          details.cancel();
        }
      });
      const removeFirstTrigger = await renderTwoTriggers(onOpenChange);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      removeFirstTrigger();
      await flushMicrotasks();

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    function renderPopup() {
      return {
        default: ({ payload }: NumberPayload) => (
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>
                <span data-testid="content">{payload}</span>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        ),
      };
    }

    it('should close when focusing a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>{renderPopup()}</Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      trigger1.focus();
      await flushMicrotasks();
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      trigger2.focus();
      await flushMicrotasks();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const showFirstTrigger = shallowRef(true);

      const Test = defineComponent(() => () => (
        <div style={{ padding: '50px' }}>
          <div style={{ display: 'flex', gap: '120px' }}>
            {showFirstTrigger.value && (
              <Tooltip.Trigger handle={testTooltip} id="trigger-1" payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
            )}
            <Tooltip.Trigger handle={testTooltip} id="trigger-2" payload={2} delay={0}>
              Trigger 2
            </Tooltip.Trigger>
          </div>

          <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId="trigger-1">
            {{
              default: ({ payload }: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              ),
            }}
          </Tooltip.Root>
        </div>
      ));

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      showFirstTrigger.value = false;
      await flushMicrotasks();

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should close when hovering a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>{renderPopup()}</Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await fireEvent.mouseLeave(trigger1);
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should switch to a rendered disabled button trigger when trigger hover is enabled', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={testTooltip}
            payload={2}
            delay={0}
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => (
                <button {...props} type="button" disabled>
                  Trigger 2
                </button>
              ),
            }}
          />

          <Tooltip.Root handle={testTooltip}>{renderPopup()}</Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await fireEvent.mouseLeave(trigger1);
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      await waitFor(() => {
        expect(trigger2).toHaveAttribute('data-popup-open');
      });
    });
  });
});
