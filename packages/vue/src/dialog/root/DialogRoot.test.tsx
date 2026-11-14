import type { CDPSession } from '@vitest/browser-playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  KeepAlive,
  Teleport,
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  shallowRef,
} from 'vue';
import type { PropType } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  dialogRootSharedTests,
  fireEvent,
  fireTouch,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  nextEvent,
  popupConformanceTests,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import {
  createScrollDocument,
  getScrollLockRegistry,
  isPageLocked as isScrollDocumentLocked,
} from '../../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../../test/fixtures/scrollDocument';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';
import { REASONS } from '../../internals/reasons';
import * as Select from '../../select/index.parts';
import * as Dialog from '../index.parts';
import { DialogStore } from '../store/DialogStore';
import DialogRootHydration from './DialogRootHydration.test.vue';
import { useDialogRootContext } from './DialogRootContext';
import { useDialogInteractions } from './useDialogRoot';

type Store = DialogStore<unknown>;

// The viewport takes its overflow from <html>, falling back to <body> when <html> doesn't
// establish its own scroll container. Whichever one propagates decides if the user can scroll.
function isPageLocked() {
  const html = document.documentElement;
  const { overflow, overflowX, overflowY } = getComputedStyle(html);
  const htmlScrolls = /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX);
  return /hidden|clip/.test(getComputedStyle(htmlScrolls ? html : document.body).overflowY);
}

// When <html> is the viewport scroller, Vase UI hides its overflow to lock the page. An external
// <body> lock never touches <html>, so this distinguishes a lock Vase UI applied itself from one
// it is still waiting to take over.
function hasOwnScrollLock(doc: Document) {
  return doc.documentElement.style.overflowX === 'hidden';
}

type OpenChangeDetails = { open: boolean; reason: string | null | undefined };

const DialogOpenChangeSpy = defineComponent({
  props: {
    onOpenChange: {
      type: Function as PropType<(details: OpenChangeDetails) => void>,
      required: true,
    },
  },
  setup(props) {
    const store = useDialogRootContext();

    function handleOpenChange(details: OpenChangeDetails) {
      props.onOpenChange(details);
    }

    onMounted(() => {
      store.context.events.on('openchange', handleOpenChange);
    });
    onUnmounted(() => {
      store.context.events.off('openchange', handleOpenChange);
    });

    return () => null;
  },
});

type PartProps = Record<string, unknown>;

const testDialogProps = {
  rootProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is the text of the trigger.
  triggerProps: { type: Object as PropType<PartProps>, default: undefined },
  portalProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is a function that returns the content of the popup.
  popupProps: { type: Object as PropType<PartProps>, default: undefined },
  omitTrigger: { type: Boolean, default: false },
  includeBackdrop: { type: Boolean, default: false },
};

const ContainedTriggerDialog = defineComponent({
  props: testDialogProps,
  setup(props) {
    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};
      const { children: popupChildren, ...restPopupProps } = props.popupProps ?? {};

      return (
        <Dialog.Root {...props.rootProps}>
          {!props.omitTrigger ? (
            <Dialog.Trigger data-testid="trigger" {...restTriggerProps}>
              {triggerChildren ?? 'Open'}
            </Dialog.Trigger>
          ) : null}
          <Dialog.Portal {...props.portalProps}>
            {props.includeBackdrop ? (
              <Dialog.Backdrop
                data-testid="backdrop"
                style={{ position: 'fixed', zIndex: 10, inset: '0px' }}
              />
            ) : null}
            <Dialog.Popup
              data-testid="dialog-popup"
              style={{ position: 'fixed', zIndex: 10 }}
              {...restPopupProps}
            >
              {typeof popupChildren === 'function' ? (
                popupChildren()
              ) : (
                <>
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </>
              )}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    };
  },
});

const DetachedTriggerDialog = defineComponent({
  props: testDialogProps,
  setup(props) {
    const dialogHandle = Dialog.createHandle();

    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};

      return (
        <>
          <Dialog.Trigger data-testid="trigger" {...restTriggerProps} handle={dialogHandle}>
            {triggerChildren ?? 'Open'}
          </Dialog.Trigger>
          <ContainedTriggerDialog
            {...props}
            rootProps={{ ...props.rootProps, handle: dialogHandle }}
            omitTrigger
          />
        </>
      );
    };
  },
});

const MultipleDetachedTriggersDialog = defineComponent({
  props: testDialogProps,
  setup(props) {
    const dialogHandle = Dialog.createHandle();

    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};

      return (
        <>
          <Dialog.Trigger data-testid="trigger" {...restTriggerProps} handle={dialogHandle}>
            {triggerChildren ?? 'Open'}
          </Dialog.Trigger>
          <Dialog.Trigger data-testid="trigger-2" handle={dialogHandle}>
            Open another
          </Dialog.Trigger>
          <ContainedTriggerDialog
            {...props}
            rootProps={{ ...props.rootProps, handle: dialogHandle }}
            omitTrigger
          />
        </>
      );
    };
  },
});

describe('<Dialog.Root />', () => {
  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Dialog.Root {...props.root}>
        <Dialog.Trigger {...props.trigger}>Open dialog</Dialog.Trigger>
        <Dialog.Portal {...props.portal}>
          <Dialog.Popup {...props.popup}>Dialog</Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  it.skipIf(!platform.engine.blink)(
    'ignores a native click whose pointerdown opened the dialog',
    async () => {
      const { cdp } = await import('vitest/browser');
      const openChangeSpy = vi.fn();
      const documentClicks: MouseEvent[] = [];

      const App = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <>
            <button type="button" onPointerdown={() => (open.value = true)}>
              Open
            </button>
            <Dialog.Root
              open={open.value}
              onOpenChange={(nextOpen, eventDetails) => {
                openChangeSpy(nextOpen, eventDetails.reason);
                open.value = nextOpen;
              }}
            >
              <Dialog.Portal>
                <Dialog.Backdrop data-testid="backdrop" style={{ position: 'fixed', inset: 0 }} />
                <Dialog.Popup data-testid="popup">Dialog</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      });

      await render(<App />);

      const openButton = screen.getByRole('button', { name: 'Open' });
      const frame = window.frameElement as HTMLIFrameElement | null;
      const frameRect = frame?.getBoundingClientRect();
      const buttonRect = openButton.getBoundingClientRect();
      const buttonCenter = {
        x:
          (frameRect?.left ?? 0) +
          (frame?.clientLeft ?? 0) +
          buttonRect.left +
          buttonRect.width / 2,
        y: (frameRect?.top ?? 0) + (frame?.clientTop ?? 0) + buttonRect.top + buttonRect.height / 2,
      };
      const session = cdp() as CDPSession;

      function recordClick(event: MouseEvent) {
        documentClicks.push(event);
      }

      document.addEventListener('click', recordClick, true);

      try {
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          ...buttonCenter,
        });
        await session.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...buttonCenter,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        });
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...buttonCenter,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        });
        await flushMicrotasks();

        // The browser synthesizes the gesture's click asynchronously after
        // the release; wait for it instead of sleeping a fixed amount.
        await waitFor(() => {
          expect(documentClicks.some((event) => event.isTrusted)).toBe(true);
        });

        const trustedClick = documentClicks.find((event) => event.isTrusted);
        expect(trustedClick?.target).not.toBe(openButton);
        // The click must land outside the popup subtree so it is evaluated as
        // an outside press; a click inside the popup would be ignored for a
        // different reason and stop covering the press-observed guard.
        expect(screen.getByTestId('popup').contains(trustedClick?.target as Node)).toBe(false);
        expect(screen.queryByTestId('popup')).not.toBe(null);
        expect(openChangeSpy).not.toHaveBeenCalledWith(false, REASONS.outsidePress);

        // The guard must only suppress the gesture that opened the dialog. A
        // fresh press observed while open still dismisses — without this the
        // suite would stay green if the press were never recorded for trusted
        // input at all.
        await session.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...buttonCenter,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        });
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...buttonCenter,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        });
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        expect(openChangeSpy).toHaveBeenCalledWith(false, REASONS.outsidePress);
      } finally {
        document.removeEventListener('click', recordClick, true);
      }
    },
  );

  dialogRootSharedTests({ parts: Dialog, popupRole: 'dialog', render });

  it('reports nested drawer counts before passive effects', async () => {
    const childStore = new DialogStore(
      { open: true, mounted: true, modal: false, disablePointerDismissal: false },
      undefined,
    );
    const parentStore = new DialogStore(undefined, undefined);
    let taskAfterMountRan = false;
    let taskAfterUnmountRan = false;
    let mountedBeforeTask: boolean | null = null;
    let unmountedBeforeTask: boolean | null = null;
    let phase: 'mount' | 'teardown' = 'mount';

    Object.assign(parentStore.context, {
      onNestedDialogOpen(dialogCount: number, drawerCount: number) {
        if (drawerCount > 0 && mountedBeforeTask === null) {
          mountedBeforeTask = !taskAfterMountRan;
        }
        if (
          phase === 'teardown' &&
          dialogCount === 0 &&
          drawerCount === 0 &&
          unmountedBeforeTask === null
        ) {
          unmountedBeforeTask = !taskAfterUnmountRan;
        }
      },
    });

    const TaskBoundary = defineComponent({
      setup() {
        onMounted(() => {
          setTimeout(() => {
            taskAfterMountRan = true;
          });
        });
        return () => null;
      },
    });
    const Interactions = defineComponent({
      setup() {
        useDialogInteractions({
          store: childStore,
          parentContext: parentStore.context,
          isDrawer: true,
        });
        return () => null;
      },
    });

    const { unmount } = await render(() => (
      <div>
        <TaskBoundary />
        <Interactions />
      </div>
    ));

    expect(mountedBeforeTask).toBe(true);

    phase = 'teardown';
    setTimeout(() => {
      taskAfterUnmountRan = true;
    });
    unmount();
    await flushMicrotasks();

    expect(unmountedBeforeTask).toBe(true);
  });

  it('keeps trigger ownership when another trigger mounts while open', async () => {
    const Test = defineComponent(() => {
      const showSecondTrigger = shallowRef(false);

      return () => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger id="trigger-1">Trigger 1</Dialog.Trigger>
          {showSecondTrigger.value && <Dialog.Trigger id="trigger-2">Trigger 2</Dialog.Trigger>}
          <Dialog.Portal>
            <Dialog.Popup>
              <button onClick={() => (showSecondTrigger.value = true)}>Mount trigger 2</button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    });

    const { user } = await render(<Test />);
    const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

    await user.click(trigger1);

    const popup = await screen.findByRole('dialog');
    const trigger1Controls = trigger1.getAttribute('aria-controls');

    expect(trigger1Controls).toBe(popup.getAttribute('id'));

    await user.click(screen.getByRole('button', { name: 'Mount trigger 2' }));

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger1.getAttribute('aria-controls')).toBe(trigger1Controls);
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).not.toHaveAttribute('aria-controls');
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerDialog },
    { name: 'detached triggers', Component: DetachedTriggerDialog },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersDialog },
  ])('when using $name', ({ Component: TestDialog }) => {
    it('rewires dismiss interactions after closing and reopening', async () => {
      const { user } = await render(<TestDialog rootProps={{ modal: false }} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      await fireEvent.click(document.body);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    it('ARIA attributes', async () => {
      await render(
        <TestDialog
          rootProps={{ modal: false, open: true }}
          popupProps={{
            children: () => (
              <>
                <Dialog.Title>title text</Dialog.Title>
                <Dialog.Description>description text</Dialog.Description>
              </>
            ),
          }}
          includeBackdrop
        />,
      );

      const popup = screen.queryByRole('dialog');
      expect(popup).not.toBe(null);

      expect(screen.getByText('title text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-labelledby'),
      );
      expect(screen.getByText('description text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-describedby'),
      );
    });

    it('keeps accessible names and descriptions in sync when label parts change', async () => {
      const DynamicLabels = defineComponent(() => {
        const phase = shallowRef(0);

        return () => (
          <>
            {phase.value < 2 && (
              <Dialog.Title key={`title-${phase.value}`}>Title {phase.value + 1}</Dialog.Title>
            )}
            {phase.value < 2 && (
              <Dialog.Description key={`description-${phase.value}`}>
                Description {phase.value + 1}
              </Dialog.Description>
            )}
            <button onClick={() => (phase.value += 1)}>Change labels</button>
          </>
        );
      });

      const { user } = await render(
        <TestDialog
          rootProps={{ modal: false, open: true }}
          popupProps={{ children: () => <DynamicLabels /> }}
        />,
      );

      const popup = screen.getByRole('dialog');
      const firstTitleId = screen.getByText('Title 1').getAttribute('id');
      const firstDescriptionId = screen.getByText('Description 1').getAttribute('id');

      expect(popup.getAttribute('aria-labelledby')).toBe(firstTitleId);
      expect(popup.getAttribute('aria-describedby')).toBe(firstDescriptionId);

      await user.click(screen.getByRole('button', { name: 'Change labels' }));

      const secondTitleId = screen.getByText('Title 2').getAttribute('id');
      const secondDescriptionId = screen.getByText('Description 2').getAttribute('id');

      await waitFor(() => {
        expect(popup.getAttribute('aria-labelledby')).toBe(secondTitleId);
      });
      await waitFor(() => {
        expect(popup.getAttribute('aria-describedby')).toBe(secondDescriptionId);
      });
      expect(secondTitleId).not.toBe(firstTitleId);
      expect(secondDescriptionId).not.toBe(firstDescriptionId);

      await user.click(screen.getByRole('button', { name: 'Change labels' }));

      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('aria-labelledby');
      expect(popup).not.toHaveAttribute('aria-describedby');
    });

    describe('prop: onOpenChange', () => {
      it('reports no trigger when closing with an initial trigger id that is not mounted', async () => {
        const handleOpenChange = vi.fn();
        let actions: Dialog.Root.Actions | null = null;

        await render(() => (
          <Dialog.Root
            ref={(instance: unknown) => {
              actions = instance as Dialog.Root.Actions | null;
            }}
            defaultOpen
            defaultTriggerId="missing-trigger"
            modal={false}
            onOpenChange={handleOpenChange}
          >
            <Dialog.Portal>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ));

        actions!.close();
        await flushMicrotasks();

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][0]).toBe(false);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.imperativeAction);
        expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
      });

      it('calls onOpenChange with the reason for change when user clicks backdrop while the modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />,
        );

        await user.click(screen.getByRole('presentation', { hidden: true }));

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('calls onOpenChange with the reason for change when user clicks outside while the non-modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
          />,
        );

        await user.click(document.body);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      describe.skipIf(isJSDOM)('clicks on user backdrop', () => {
        it('detects clicks on user backdrop', async () => {
          const handleOpenChange = vi.fn();

          const { user } = await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              popupProps={{ style: { position: 'fixed', zIndex: 10 } }}
              includeBackdrop
            />,
          );

          await user.click(screen.getByTestId('backdrop'));

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        });

        it('does not change open state on non-main button clicks', async () => {
          const handleOpenChange = vi.fn();

          const { user } = await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              includeBackdrop
            />,
          );

          const backdrop = screen.getByTestId('backdrop');
          await user.pointer([{ target: backdrop }, { keys: '[MouseRight]', target: backdrop }]);

          expect(handleOpenChange.mock.calls.length).toBe(0);
        });
      });

      it('emits a single internal openchange when closing on Escape', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = await render(
          <TestDialog
            rootProps={{ defaultOpen: true }}
            popupProps={{
              children: () => (
                <>
                  <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </>
              ),
            }}
          />,
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(handleInternalOpenChange.mock.calls.length).toBe(1);
        expect(handleInternalOpenChange.mock.calls[0][0]).toMatchObject({
          open: false,
          reason: REASONS.escapeKey,
        });
      });

      it('does not emit internal openchange when an Escape close is canceled', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = await render(
          <TestDialog
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen: boolean, eventDetails: Dialog.Root.ChangeEventDetails) => {
                if (!nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              children: () => (
                <>
                  <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </>
              ),
            }}
          />,
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleInternalOpenChange.mock.calls.length).toBe(0);
      });
    });

    describe('prop: disablePointerDismissal', () => {
      it.each([
        { disablePointerDismissal: true, expectDismissed: false, outcome: 'does not close' },
        { disablePointerDismissal: false, expectDismissed: true, outcome: 'closes' },
        { disablePointerDismissal: undefined, expectDismissed: true, outcome: 'closes' },
      ])(
        '$outcome the dialog when clicking outside if disablePointerDismissal=$disablePointerDismissal',
        async ({ disablePointerDismissal, expectDismissed }) => {
          const handleOpenChange = vi.fn();

          await render(
            <div data-testid="outside">
              <TestDialog
                rootProps={{
                  defaultOpen: true,
                  onOpenChange: handleOpenChange,
                  disablePointerDismissal,
                  modal: false,
                }}
              />
            </div>,
          );

          const outside = screen.getByTestId('outside');

          await fireEvent.mouseDown(outside);
          await fireEvent.click(outside);
          expect(handleOpenChange.mock.calls.length === 1).toBe(expectDismissed);
          expect(screen.queryByRole('dialog') === null).toBe(expectDismissed);
        },
      );
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
            includeBackdrop
          />,
        );

        const backdrop = screen.getByTestId('backdrop');

        await fireEvent.mouseDown(backdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        await fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        const internalBackdrop = screen.getByRole('presentation', { hidden: true });

        await fireEvent.mouseDown(internalBackdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        await fireEvent.click(internalBackdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via intentional outside press with user backdrop (modal=true): works when portaled into a shadow DOM', async () => {
        const handleOpenChange = vi.fn();

        const container = document.body.appendChild(document.createElement('div'));
        const shadowRoot = container.attachShadow({ mode: 'open' });

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
            portalProps={{ container: shadowRoot }}
            includeBackdrop
          />,
        );

        const backdrop = shadowRoot.querySelector('[data-testid="backdrop"]') as HTMLElement;

        await fireEvent.click(backdrop);
        await waitFor(() => {
          expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <Teleport to={container}>
              <button data-testid="outside">Outside</button>
              <TestDialog
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
                portalProps={{ container: shadowRoot }}
              />
            </Teleport>,
          );

          const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;

          await fireEvent.click(outsideButton);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          host.remove();
        }
      });

      it('closes when the outside press targets the document', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        await fireEvent.click(document);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('suppresses only the click of a press that starts inside and ends on the document', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        const popup = screen.getByTestId('dialog-popup');

        await fireEvent.pointerDown(popup, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(popup, { button: 0 });
        await fireEvent.pointerUp(document, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseUp(document, { button: 0 });
        await fireEvent.click(document);
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        await fireEvent.pointerDown(document, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(document, { button: 0 });
        await fireEvent.pointerUp(document, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseUp(document, { button: 0 });
        await fireEvent.click(document);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('closing via outside press: works when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <Teleport to={container}>
              <TestDialog
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
                portalProps={{ container: shadowRoot }}
              />
            </Teleport>,
          );

          await fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          host.remove();
        }
      });

      it('closing via outside press: works for a modal dialog when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <Teleport to={container}>
              <TestDialog
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
                portalProps={{ container: shadowRoot }}
              />
            </Teleport>,
          );

          await fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          host.remove();
        }
      });
    });

    it.skipIf(isJSDOM)('waits for the exit transition to finish before unmounting', async () => {
      const css = `
    .dialog {
      opacity: 0;
      transition: opacity 200ms;
    }
    .dialog[data-open] {
      opacity: 1;
    }
  `;

      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const notifyTransitionEnd = vi.fn();

      const TransitionTest = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup(props) {
          return () => (
            <>
              <style>{css}</style>
              <TestDialog
                rootProps={{ open: props.open, modal: false }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  class: 'dialog',
                  onTransitionend: notifyTransitionEnd,
                }}
              />
            </>
          );
        },
      });

      const { setProps } = await render(<TransitionTest open />);
      const transitionEnded = nextEvent(screen.getByRole('dialog'), 'transitionend');

      await setProps({ open: false });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      // The popup hides in the microtask after its transition finishes. The browser sends
      // `transitionend` after that microtask.
      await transitionEnded;
      expect(notifyTransitionEnd.mock.calls.length).toBe(1);
    });

    describe('prop: modal', () => {
      it('makes other interactive elements on the page inert when a modal dialog is open', async () => {
        await render(<TestDialog rootProps={{ defaultOpen: true, modal: true }} />);

        expect(screen.getByRole('presentation', { hidden: true })).not.toBe(null);
      });

      it('does not make other interactive elements on the page inert when a non-modal dialog is open', async () => {
        await render(<TestDialog rootProps={{ defaultOpen: true, modal: false }} />);

        expect(screen.queryByRole('presentation')).toBe(null);
      });

      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestDialog rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toHaveAttribute(
          'role',
          'presentation',
        );
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestDialog rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toBe(null);
      });
    });

    it('does not dismiss previous modal dialog when clicking new modal dialog', async () => {
      const App = defineComponent(() => {
        const openNested = shallowRef(false);
        const openNested2 = shallowRef(false);

        return () => (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={{
                children: () => (
                  <button onClick={() => (openNested.value = true)}>Open nested 1</button>
                ),
              }}
            />
            <TestDialog
              rootProps={{
                open: openNested.value,
                onOpenChange: (open: boolean) => (openNested.value = open),
              }}
              popupProps={{
                children: () => (
                  <button onClick={() => (openNested2.value = true)}>Open nested 2</button>
                ),
              }}
            />
            <TestDialog
              rootProps={{
                open: openNested2.value,
                onOpenChange: (open: boolean) => (openNested2.value = open),
              }}
              popupProps={{ children: () => 'Final nested' }}
            />
          </div>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Open base' });
      await user.click(trigger);
      await waitForLaterMillisecond();

      const nestedButton1 = screen.getByRole('button', { name: 'Open nested 1' });
      await user.click(nestedButton1);
      await waitForLaterMillisecond();

      const nestedButton2 = screen.getByRole('button', { name: 'Open nested 2' });
      await user.click(nestedButton2);

      const finalDialog = screen.getByText('Final nested');

      expect(finalDialog).not.toBe(null);
    });

    it('dismisses non-nested dialogs one by one', async () => {
      const App = defineComponent(() => {
        const openNested = shallowRef(false);
        const openNested2 = shallowRef(false);

        return () => (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={{
                'data-testid': 'level-1',
                children: () => (
                  <button onClick={() => (openNested.value = true)}>Open nested 1</button>
                ),
              }}
            />
            <TestDialog
              rootProps={{
                open: openNested.value,
                onOpenChange: (open: boolean) => (openNested.value = open),
              }}
              popupProps={{
                'data-testid': 'level-2',
                children: () => (
                  <button onClick={() => (openNested2.value = true)}>Open nested 2</button>
                ),
              }}
            />
            <TestDialog
              rootProps={{
                open: openNested2.value,
                onOpenChange: (open: boolean) => (openNested2.value = open),
              }}
              popupProps={{ 'data-testid': 'level-3', children: () => 'Final nested' }}
            />
          </div>
        );
      });

      await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Open base' });
      await fireEvent.click(trigger);
      await waitForLaterMillisecond();

      const nestedButton1 = screen.getByRole('button', { name: 'Open nested 1' });
      await fireEvent.click(nestedButton1);
      await waitForLaterMillisecond();

      const nestedButton2 = screen.getByRole('button', { name: 'Open nested 2' });
      await fireEvent.click(nestedButton2);

      const backdrops = Array.from(document.querySelectorAll('[role="presentation"]'));
      await fireEvent.click(backdrops[backdrops.length - 1]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-3')).toBe(null);
      });

      expect(screen.getByTestId('level-2')).toBeInTheDocument();
      expect(screen.getByTestId('level-1')).toBeInTheDocument();

      await fireEvent.click(backdrops[backdrops.length - 2]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-2')).toBe(null);
      });

      expect(screen.getByTestId('level-1')).toBeInTheDocument();

      await fireEvent.click(backdrops[backdrops.length - 3]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-1')).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('nested popups', () => {
      it('should not dismiss the dialog when dismissing outside a nested select popup', async () => {
        const { user } = await render(
          <TestDialog
            popupProps={{
              children: () => (
                <Select.Root>
                  <Select.Trigger data-testid="select-trigger">Open select</Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner data-testid="select-positioner">
                      <Select.Popup>
                        <Select.Item>Item</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              ),
            }}
          />,
        );

        const dialogTrigger = screen.getByRole('button', { name: 'Open' });
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });
        await waitForLaterMillisecond();

        const selectTrigger = screen.getByTestId('select-trigger');

        await user.click(selectTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });
        await waitForLaterMillisecond();

        const selectPositioner = screen.getByTestId('select-positioner');
        const selectInternalBackdrop = selectPositioner.previousElementSibling as HTMLElement;

        await user.click(selectInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const dialogPopup = screen.getByTestId('dialog-popup');
        const dialogInternalBackdrop = dialogPopup.previousElementSibling
          ?.previousElementSibling as HTMLElement;

        await user.click(dialogInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('pointerdown removal', () => {
      it('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', async () => {
        const Test = defineComponent(() => {
          const showButton = shallowRef(true);
          return () => (
            <TestDialog
              rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
              popupProps={{
                children: () =>
                  showButton.value && (
                    <button data-testid="remove" onPointerdown={() => (showButton.value = false)}>
                      Remove on pointer down
                    </button>
                  ),
              }}
            />
          );
        });

        const { user } = await render(<Test />);

        const removeButton = screen.getByTestId('remove');
        await waitFor(() => {
          expect(removeButton).toHaveFocus();
        });
        await fireEvent.pointerDown(removeButton);

        const popup = screen.getByTestId('dialog-popup');
        await waitFor(() => {
          expect(popup).toHaveFocus();
        });

        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('dismisses on first outside click after NumberField scrub interaction (pointer lock path)', async () => {
        const originalRequestPointerLock = Element.prototype.requestPointerLock;
        const requestPointerLockSpy = vi.fn(() => Promise.resolve());

        try {
          Element.prototype.requestPointerLock =
            requestPointerLockSpy as typeof originalRequestPointerLock;

          await render(
            <ContainedTriggerDialog
              rootProps={{ defaultOpen: true, modal: false }}
              popupProps={{
                children: () => (
                  <NumberField.Root defaultValue={100}>
                    <NumberField.ScrubArea data-testid="scrub-area">
                      <span>Amount</span>
                    </NumberField.ScrubArea>
                    <NumberField.Input aria-label="Amount" />
                  </NumberField.Root>
                ),
              }}
            />,
          );

          const scrubArea = screen.getByTestId('scrub-area');

          await fireEvent.pointerDown(scrubArea, { pointerType: 'mouse', button: 0 });
          await fireEvent.mouseDown(scrubArea, { button: 0 });
          await fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
          await fireEvent.mouseUp(document.body, { button: 0 });
          // A press that starts inside with a prevented `pointerdown` and ends outside suppresses the
          // next click until a timer of 0 ms ends.
          await wait(0);

          await fireEvent.click(document.body);

          await waitFor(() => {
            expect(screen.queryByRole('dialog')).toBe(null);
          });
          // The scrub area requests no pointer lock in WebKit.
          expect(requestPointerLockSpy.mock.calls.length).toBe(platform.engine.webkit ? 0 : 1);
        } finally {
          Element.prototype.requestPointerLock = originalRequestPointerLock;
        }
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('waits for a restarted enter animation to finish', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        // The first animation lasts 100 s, so it still runs when the test swaps it.
        const style = `
          @keyframes test-enter-a {
            from {
              opacity: 0;
            }
          }

          @keyframes test-enter-b {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator.animation-a[data-open] {
            animation: test-enter-a 100s linear;
          }

          .animation-test-indicator.animation-b[data-open] {
            animation: test-enter-b 50ms linear;
          }
        `;

        const Test = defineComponent(() => {
          const open = shallowRef(false);
          const variant = shallowRef<'a' | 'b'>('a');

          return () => (
            <div>
              <style>{style}</style>
              <button onClick={() => (open.value = true)}>Open externally</button>
              <button onClick={() => (variant.value = variant.value === 'a' ? 'b' : 'a')}>
                Swap animation
              </button>
              <TestDialog
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => (open.value = nextOpen),
                  onOpenChangeComplete,
                }}
                popupProps={{
                  class: `animation-test-indicator animation-${variant.value}`,
                }}
              />
            </div>
          );
        });

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await nextEvent(document, 'animationstart', { action: () => user.click(openButton) });

        const swapButton = screen.getByText('Swap animation');
        await user.click(swapButton);

        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls.length).toBe(0);

        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls.length).toBe(1);
        });
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      it('does not get called on open when dismissed during the enter animation', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        // The enter transition lasts 100 s, so it still runs at the outside press.
        const style = `
          .animation-test-indicator {
            opacity: 0;
            transition: opacity 200ms linear;
          }

          .animation-test-indicator[data-open] {
            opacity: 1;
            transition-duration: 100s;
          }

          .animation-test-indicator[data-open][data-starting-style] {
            opacity: 0;
          }

          .animation-test-indicator[data-ending-style] {
            opacity: 0;
          }
        `;

        const Test = defineComponent(() => {
          const open = shallowRef(false);

          return () => (
            <div>
              <style>{style}</style>
              <button onClick={() => (open.value = true)}>Open externally</button>
              <TestDialog
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => (open.value = nextOpen),
                  onOpenChangeComplete,
                }}
                popupProps={{
                  class: 'animation-test-indicator',
                }}
              />
            </div>
          );
        });

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await nextEvent(document, 'transitionrun', { action: () => user.click(openButton) });

        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls.length).toBe(1);
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(false);
      });
    });
  });

  it('does not close on a right-button outside press', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <div>
        <button data-testid="outside">Outside</button>
        <Dialog.Root defaultOpen modal="trap-focus" onOpenChange={handleOpenChange}>
          <Dialog.Portal>
            <Dialog.Popup>Dialog</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>,
    );

    await fireEvent.pointerDown(screen.getByTestId('outside'), {
      bubbles: true,
      button: 2,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });

  it('closes one sibling dialog per Escape press when several open together', async () => {
    const SiblingDialog = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        return () => (
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Popup data-testid={props.name}>
                <Dialog.Close>Close {props.name}</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      },
    });

    const { user } = await render(
      <>
        <SiblingDialog name="a" />
        <SiblingDialog name="b" />
        <SiblingDialog name="c" />
      </>,
    );

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('c')).toBe(null);
    });
    expect(screen.queryByTestId('b')).not.toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('b')).toBe(null);
    });
    expect(screen.queryByTestId('a')).not.toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('a')).toBe(null);
    });
  });

  it('closes the newest sibling dialog on Escape after an older one remounts its popup', async () => {
    const Test = defineComponent({
      props: { popupKey: { type: Number, required: true } },
      setup(props) {
        return () => (
          <>
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup key={props.popupKey} initialFocus={false} data-testid="a" />
              </Dialog.Portal>
            </Dialog.Root>
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup initialFocus={false} data-testid="b" />
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      },
    });

    // Neither popup takes focus, so the remount can't move it and Escape reaches the document.
    const { setProps, user } = await render(<Test popupKey={0} />);
    const popupA = screen.getByTestId('a');

    await setProps({ popupKey: 1 });
    expect(screen.getByTestId('a')).not.toBe(popupA);
    expect(document.activeElement).toBe(document.body);

    await user.keyboard('[Escape]');

    await waitFor(() => {
      expect(screen.queryByTestId('b')).toBe(null);
    });
    expect(screen.queryByTestId('a')).not.toBe(null);
  });

  describe('closed shadow root', () => {
    let host: HTMLElement;
    let shadowRoot: ShadowRoot;
    let container: HTMLElement;

    beforeEach(() => {
      host = document.body.appendChild(document.createElement('div'));
      shadowRoot = host.attachShadow({ mode: 'closed' });
      container = shadowRoot.appendChild(document.createElement('div'));
    });

    afterEach(() => {
      host.remove();
    });

    async function query(testId: string) {
      const selector = `[data-testid="${testId}"]`;
      return waitFor(() => {
        const element = shadowRoot.querySelector(selector) ?? document.querySelector(selector);
        expect(element).not.toBe(null);
        return element as HTMLElement;
      });
    }

    // For trusted input, the browser runs a microtask checkpoint after each listener, so Vue applies
    // the update of the press before the press reaches the shadow host. A dispatched click gives no
    // such checkpoint, and a key press on a focused button gives a trusted click.
    async function click(testId: string) {
      const element = await query(testId);
      // The popup can open in the millisecond of the click before. Vue skips the second and later
      // listeners of an event in the millisecond in which it attached them.
      await waitForLaterMillisecond();
      if (element instanceof HTMLButtonElement) {
        element.focus();
        await userEvent.keyboard('{Enter}');
      } else {
        element.click();
      }
      await flushMicrotasks();
    }

    type PortalContainer = 'shadow root' | 'body' | undefined;

    const resolveContainer = (target: PortalContainer) =>
      target && { 'shadow root': shadowRoot, body: document.body }[target];

    // Alert Dialog has no popup parts, so the kind `alert dialog` of Base UI is not in the list.
    const nestedKinds = [
      {
        name: 'modal dialog',
        modal: true,
        render: (portalContainer: ShadowRoot | HTMLElement | undefined) => (
          <Dialog.Root>
            <Dialog.Trigger data-testid="open-nested">Open nested</Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
              <Dialog.Backdrop />
              <Dialog.Popup data-testid="nested">
                <Dialog.Close data-testid="close-nested">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
      },
      {
        name: 'non-modal dialog',
        modal: false,
        render: (portalContainer: ShadowRoot | HTMLElement | undefined) => (
          <Dialog.Root modal={false}>
            <Dialog.Trigger data-testid="open-nested">Open nested</Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
              <Dialog.Popup data-testid="nested">
                <Dialog.Close data-testid="close-nested">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
      },
    ];

    // `undefined` means the portal's default: the parent portal's node, else the body.
    const portalSetups: Array<{ outer: PortalContainer; nested: PortalContainer }> = [
      { outer: 'shadow root', nested: undefined },
      { outer: 'shadow root', nested: 'shadow root' },
      { outer: 'shadow root', nested: 'body' },
      { outer: undefined, nested: undefined },
      { outer: undefined, nested: 'shadow root' },
    ];

    describe.for(nestedKinds)('nested $name', (nestedKind) => {
      it.for(portalSetups)(
        'keeps the parent open on close (outer: $outer, nested: $nested)',
        async ({ outer, nested }) => {
          const handleOpenChange = vi.fn();

          await render(
            <Teleport to={container}>
              <Dialog.Root defaultOpen modal={nestedKind.modal} onOpenChange={handleOpenChange}>
                <Dialog.Portal container={resolveContainer(outer)}>
                  {nestedKind.modal && <Dialog.Backdrop />}
                  <Dialog.Popup data-testid="outer">
                    {nestedKind.render(resolveContainer(nested))}
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Teleport>,
          );

          await click('open-nested');
          await query('nested');

          await click('close-nested');

          expect(await query('outer')).not.toBe(null);
          expect(shadowRoot.querySelector('[data-testid="nested"]')).toBe(null);
          expect(document.querySelector('[data-testid="nested"]')).toBe(null);
          expect(handleOpenChange).not.toHaveBeenCalled();
        },
      );
    });

    it('still dismisses on a press outside the popup', async () => {
      const handleOpenChange = vi.fn();

      await render(
        <Teleport to={container}>
          <div data-testid="outside">Outside</div>
          <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
            <Dialog.Portal container={shadowRoot}>
              <Dialog.Popup data-testid="outer" />
            </Dialog.Portal>
          </Dialog.Root>
        </Teleport>,
      );

      await query('outer');
      await click('outside');

      expect(shadowRoot.querySelector('[data-testid="outer"]')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  describe.skipIf(isJSDOM)('touch outside press', () => {
    // Simulates a finger tapping outside the dialog: a `touchstart`, a small
    // (~6px) `touchmove` that marks the press as a dismiss without crossing the
    // 10px threshold that would dismiss during the move itself, and a `touchend`
    // whose lifted point is reported in `changedTouches` (`touches` is empty),
    // mirroring real browsers.
    async function tapOutside(element: HTMLElement) {
      const start = { clientX: 50, clientY: 50 };
      const end = { clientX: 50, clientY: 56 };

      await fireTouch.start(element, { touches: [start] });
      await fireTouch.move(element, { touches: [end] });
      await fireTouch.end(element, { changedTouches: [end] });
    }

    async function expectClosesOnTouchTapOutside(modal: false | 'trap-focus') {
      const handleOpenChange = vi.fn();

      await render(
        <div>
          <button data-testid="outside">Outside</button>
          <Dialog.Root defaultOpen modal={modal} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );

      expect(screen.queryByRole('dialog')).not.toBe(null);

      await tapOutside(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    }

    function renderNonModalDialog(handleOpenChange: Mock) {
      return render(
        <div>
          <button data-testid="outside">Outside</button>
          <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );
    }

    it('closes a non-modal dialog without a backdrop', async () => {
      await expectClosesOnTouchTapOutside(false);
    });

    it('closes a trap-focus dialog without a backdrop', async () => {
      await expectClosesOnTouchTapOutside('trap-focus');
    });

    it('does not close when another touch is still active on touchend', async () => {
      const handleOpenChange = vi.fn();

      await renderNonModalDialog(handleOpenChange);

      const outside = screen.getByTestId('outside');
      const touch1Start = { clientX: 50, clientY: 50 };
      const touch2Start = { clientX: 70, clientY: 70 };
      const touch1End = { clientX: 50, clientY: 56 };

      await fireTouch.start(outside, { touches: [touch1Start, touch2Start] });
      await fireTouch.move(outside, { touches: [touch1End, touch2Start] });
      await fireTouch.end(outside, { changedTouches: [touch1End], touches: [touch2Start] });

      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).not.toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('does not close when two touches are lifted simultaneously on touchend', async () => {
      const handleOpenChange = vi.fn();

      await renderNonModalDialog(handleOpenChange);

      const outside = screen.getByTestId('outside');
      const touch1Start = { clientX: 50, clientY: 50 };
      const touch2Start = { clientX: 70, clientY: 70 };
      const touch1End = { clientX: 50, clientY: 56 };
      const touch2End = { clientX: 70, clientY: 76 };

      await fireTouch.start(outside, { touches: [touch1Start, touch2Start] });
      await fireTouch.move(outside, { touches: [touch1End, touch2End] });
      await fireTouch.end(outside, { changedTouches: [touch1End, touch2End], touches: [] });

      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).not.toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('does not close when multiple touches move past the drag dismissal threshold', async () => {
      const handleOpenChange = vi.fn();

      await renderNonModalDialog(handleOpenChange);

      const outside = screen.getByTestId('outside');
      const touch1Start = { clientX: 50, clientY: 50 };
      const touch2Start = { clientX: 70, clientY: 70 };
      const touch1Move = { clientX: 50, clientY: 70 };
      const touch2Move = { clientX: 70, clientY: 90 };

      await fireTouch.start(outside, { touches: [touch1Start, touch2Start] });
      await fireTouch.move(outside, { touches: [touch1Move, touch2Move] });

      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).not.toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('closes as soon as a single touch moves past the drag dismissal threshold', async () => {
      const handleOpenChange = vi.fn();

      await renderNonModalDialog(handleOpenChange);

      const outside = screen.getByTestId('outside');
      const touchStart = { clientX: 50, clientY: 50 };
      const touchMove = { clientX: 50, clientY: 70 };

      await fireTouch.start(outside, { touches: [touchStart] });
      await fireTouch.move(outside, { touches: [touchMove] });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  describe('external scroll lock handoff', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('style');
      document.body.removeAttribute('style');
      document.body.removeAttribute('data-scroll-locked');
    });

    // Each entry reproduces a real third-party locker's exact DOM mechanism. Their cleanup is
    // deferred past our own deferred lock, which is what an exit animation does in practice.
    describe.skipIf(isJSDOM)('when a third-party overlay is still unlocking', () => {
      describe.for([
        {
          name: 'react-remove-scroll, via an attribute and a stylesheet',
          lock: () => {
            const style = document.createElement('style');
            style.textContent = 'body[data-scroll-locked]{overflow:hidden!important;}';
            document.head.appendChild(style);
            document.body.setAttribute('data-scroll-locked', '1');
            return () => {
              style.remove();
              document.body.removeAttribute('data-scroll-locked');
            };
          },
        },
        {
          name: 'silk-hq, via the <body> overflow shorthand',
          lock: () => {
            document.body.style.setProperty('overflow', 'hidden');
            return () => document.body.style.removeProperty('overflow');
          },
        },
        {
          name: 'Ariakit, via <html> overflow longhands',
          lock: () => {
            const { style } = document.documentElement;
            style.setProperty('scrollbar-gutter', 'stable');
            style.setProperty('overflow-x', 'hidden');
            style.setProperty('overflow-y', 'hidden');
            return () => {
              style.removeProperty('scrollbar-gutter');
              style.removeProperty('overflow-x');
              style.removeProperty('overflow-y');
            };
          },
        },
      ])('$name', ({ lock }) => {
        it('keeps the page locked until it takes over, and unlocks on close', async () => {
          const App = defineComponent(() => {
            const open = shallowRef(false);
            const timeout = useTimeout();

            return () => (
              <>
                <button
                  onClick={() => {
                    timeout.start(200, lock());
                    open.value = true;
                  }}
                >
                  Open dialog
                </button>
                <Dialog.Root
                  open={open.value}
                  onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
                >
                  <Dialog.Portal>
                    <Dialog.Popup>
                      <Dialog.Close>Close dialog</Dialog.Close>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </>
            );
          });

          await render(<App />);
          expect(`initial: ${isPageLocked()}`).toBe('initial: false');

          await fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
          await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBe(null);
          });

          // Spans the external unlock at 200ms: there must be no gap where the page scrolls.
          for (const at of [0, 120, 260, 400]) {
            await wait(at === 0 ? 0 : 140);
            expect(`t${at}: ${isPageLocked()}`).toBe(`t${at}: true`);
          }

          await fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
          await waitFor(() => {
            expect(screen.queryByRole('dialog')).toBe(null);
          });
          await waitFor(() => {
            expect(`after close: ${isPageLocked()}`).toBe('after close: false');
          });
        });
      });
    });

    it('locks immediately when an external <body> lock cannot affect the page', async () => {
      // <html> owns the viewport scroll, so `overflow: hidden` on <body> leaves the page
      // scrollable and must not be mistaken for an effective lock.
      document.documentElement.style.overflowY = 'scroll';
      document.body.style.overflowY = 'hidden';

      await render(
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close>Close dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      // Flush the scroll locker's deferred lock, scheduled on a 0ms timeout.
      await wait(0);

      expect(hasOwnScrollLock(document)).toBe(true);

      await fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
      await waitFor(() => {
        expect(hasOwnScrollLock(document)).toBe(false);
      });
    });
  });

  it.skipIf(isJSDOM)(
    'keeps focus trapped when dialog content contains a non-scrollable scroll area',
    async () => {
      const { user } = await render(
        <div>
          <button data-testid="outside-before">Outside before</button>
          <ContainedTriggerDialog
            rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
            popupProps={{
              children: () => (
                <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
                  <ScrollArea.Viewport
                    data-testid="viewport"
                    style={{ width: '100%', height: '100%' }}
                  >
                    <div style={{ width: '100px', height: '100px' }}>Non-scrollable content</div>
                  </ScrollArea.Viewport>
                </ScrollArea.Root>
              ),
            }}
            omitTrigger
          />
          <button data-testid="outside-after">Outside after</button>
        </div>,
      );

      const popup = screen.getByRole('dialog');
      const outsideBefore = screen.getByTestId('outside-before');
      const outsideAfter = screen.getByTestId('outside-after');

      await waitFor(() => {
        expect(popup.contains(document.activeElement)).toBe(true);
      });

      await user.keyboard('[Tab]');
      expect(popup.contains(document.activeElement)).toBe(true);

      await user.keyboard('[Tab]');
      expect(popup.contains(document.activeElement)).toBe(true);

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(popup.contains(document.activeElement)).toBe(true);

      expect(outsideBefore).not.toHaveFocus();
      expect(outsideAfter).not.toHaveFocus();
    },
  );

  describe('open state', () => {
    it('emits openChange and then update:open', async () => {
      const calls: string[] = [];
      let root!: Dialog.Root.Actions;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(open, eventDetails) =>
            calls.push(`openChange ${open} ${eventDetails.reason}`)
          }
          {...{ 'onUpdate:open': (open: boolean) => calls.push(`update:open ${open}`) }}
          onOpenChangeComplete={(open) => calls.push(`openChangeComplete ${open}`)}
        >
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await waitFor(() => {
        expect(calls).toEqual(['openChangeComplete true']);
      });
      calls.length = 0;

      root.close();
      await flushMicrotasks();

      expect(calls).toEqual([
        `openChange false ${REASONS.imperativeAction}`,
        'update:open false',
        'openChangeComplete false',
      ]);
    });

    it('does not emit update:open for a change that a listener cancels', async () => {
      const handleUpdate = vi.fn();
      let root!: Dialog.Root.Actions;
      let store!: Store;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.cancel()}
          {...{ 'onUpdate:open': handleUpdate }}
        >
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      root.close();
      await flushMicrotasks();

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(store.select('open')).toBe(true);
    });

    it('keeps the popup mounted after preventUnmountOnClose() until the unmount action', async () => {
      const handleComplete = vi.fn();
      let root!: Dialog.Root.Actions;
      let store!: Store;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.preventUnmountOnClose()}
          onOpenChangeComplete={handleComplete}
        >
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await waitFor(() => {
        expect(handleComplete.mock.calls).toEqual([[true]]);
      });
      handleComplete.mockClear();

      root.close();
      await flushMicrotasks();
      expect(store.select('open')).toBe(false);
      expect(store.select('mounted')).toBe(true);
      expect(handleComplete).not.toHaveBeenCalled();

      root.unmount();
      await flushMicrotasks();
      expect(store.select('mounted')).toBe(false);
      expect(handleComplete.mock.calls).toEqual([[false]]);
    });
  });

  describe('state of the root in the store', () => {
    it.each([
      { name: 'no modal prop', props: {}, modal: true },
      { name: 'a bare modal attribute', props: { modal: '' }, modal: true },
      { name: 'modal false', props: { modal: false }, modal: false },
      { name: 'modal trap-focus', props: { modal: 'trap-focus' }, modal: 'trap-focus' },
    ])('gives $name to the store', async ({ props, modal }) => {
      let store!: Store;
      await render(() => (
        <Dialog.Root {...(props as object)}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      expect(store.select('modal')).toBe(modal);
      expect(store.select('role')).toBe('dialog');
      expect(store.select('nested')).toBe(false);
      expect(store.select('disablePointerDismissal')).toBe(false);
    });

    it('follows a change of modal and of disablePointerDismissal', async () => {
      let store!: Store;
      const modal = shallowRef<boolean | 'trap-focus'>(true);
      const disablePointerDismissal = shallowRef(false);
      await render(() => (
        <Dialog.Root modal={modal.value} disablePointerDismissal={disablePointerDismissal.value}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      modal.value = 'trap-focus';
      disablePointerDismissal.value = true;
      await flushMicrotasks();

      expect(store.select('modal')).toBe('trap-focus');
      expect(store.select('disablePointerDismissal')).toBe(true);
    });

    it('clears the open method when the dialog closes', async () => {
      const handle = Dialog.createHandle();
      let store!: Store;
      await render(() => (
        <Dialog.Root handle={handle} defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));
      store.set('openMethod', 'touch');

      handle.close();
      await flushMicrotasks();

      expect(store.select('openMethod')).toBe(null);
    });

    it('gives the popup element as the positioner element', async () => {
      let store!: Store;
      await render(() => (
        <Dialog.Root defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(store.select('positionerElement')).toBe(screen.getByRole('dialog'));
    });
  });

  describe('handle', () => {
    it('gives the payload of openWithPayload() to the default slot, and isOpen follows the root', async () => {
      const handle = Dialog.createHandle<number>();
      // The computed reads `isOpen` before a root attaches. It follows the root only when `isOpen`
      // depends on the pointer of the handle.
      const isOpen = computed(() => handle.isOpen);
      expect(isOpen.value).toBe(false);
      await render(() => (
        <Dialog.Root handle={handle}>
          {{
            default: ({ payload }: { payload: number | undefined }) => (
              <span data-testid="payload">{String(payload)}</span>
            ),
          }}
        </Dialog.Root>
      ));
      expect(screen.getByTestId('payload').textContent).toBe('undefined');
      expect(isOpen.value).toBe(false);

      handle.openWithPayload(7);
      await flushMicrotasks();
      expect(screen.getByTestId('payload').textContent).toBe('7');
      expect(isOpen.value).toBe(true);

      handle.close();
      await flushMicrotasks();
      expect(isOpen.value).toBe(false);
    });

    it('opens with no trigger and warns when open() names an id that no trigger has', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handle = Dialog.createHandle();
      const handleOpenChange = vi.fn();
      await render(() => <Dialog.Root handle={handle} onOpenChange={handleOpenChange} />);

      handle.open('missing');
      await flushMicrotasks();

      expect(handle.isOpen).toBe(true);
      expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            'Vase UI: DialogHandle.open: No trigger found with id "missing".',
          ),
        ],
      ]);
    });
  });

  describe('dismissal', () => {
    // The modal marks make `Dialog.Backdrop` inert, so a real press on it reaches the internal
    // backdrop below it. The marks leave the internal backdrop.
    it.each([
      { name: 'its backdrop', backdrop: true },
      { name: 'its internal backdrop', backdrop: false },
    ])('closes a modal dialog for a real press on $name', async ({ backdrop }) => {
      const handleOpenChange = vi.fn();
      await render(
        <div data-testid="page">
          <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
            <Dialog.Portal data-testid="portal">
              {backdrop ? (
                <Dialog.Backdrop
                  data-testid="backdrop"
                  style={{ position: 'fixed', inset: '0px' }}
                />
              ) : null}
              <Dialog.Popup style={{ position: 'fixed', top: '0px', left: '0px', width: '10px' }}>
                Dialog
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );
      const target = backdrop
        ? screen.getByTestId('backdrop')
        : screen.getByTestId('portal').querySelector<HTMLElement>('[role="presentation"]')!;
      await waitFor(() => {
        expect(screen.getByTestId('page').closest('[inert]')).not.toBe(null);
      });
      expect(target.closest('[inert]') !== null).toBe(backdrop);

      await userEvent.click(target, { force: true });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(handleOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.outsidePress);
    });

    it.each([
      { name: 'a dialog that is not modal', modal: false as const, closesOnPointerdown: false },
      { name: 'a trap-focus dialog', modal: 'trap-focus' as const, closesOnPointerdown: true },
    ])('closes $name on its outside press event', async ({ modal, closesOnPointerdown }) => {
      await render(() => (
        <div>
          <button>outside</button>
          <Dialog.Root defaultOpen modal={modal}>
            <Dialog.Portal>
              <Dialog.Popup />
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      ));
      const outside = screen.getByText('outside');

      await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
      expect(screen.queryByRole('dialog') === null).toBe(closesOnPointerdown);

      await fireEvent.click(outside, { detail: 1 });
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('closes a modal dialog that has a backdrop only for a press on the backdrop', async () => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <button>outside</button>
          <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
            <Dialog.Backdrop data-testid="backdrop" />
            <Dialog.Portal>
              <Dialog.Popup />
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      ));
      const outside = screen.getByText('outside');
      const backdrop = screen.getByTestId('backdrop');

      await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
      await fireEvent.click(outside, { detail: 1 });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await fireEvent.pointerDown(backdrop, { pointerType: 'mouse', button: 0 });
      expect(screen.queryByRole('dialog')).not.toBe(null);
      await fireEvent.click(backdrop, { detail: 1 });
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  describe('nested dialogs', () => {
    function renderNested(options: { childOpen?: boolean; parentOpen?: boolean } = {}) {
      const stores: { parent?: Store; child?: Store; grandchild?: Store } = {};
      const grandchildOpen = shallowRef(false);
      const result = render(() => (
        <Dialog.Root defaultOpen={options.parentOpen ?? true} modal={false}>
          <DialogStoreProbe onStore={(value) => (stores.parent = value)} />
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent">
              <Dialog.Root defaultOpen={options.childOpen ?? false} modal={false}>
                <DialogStoreProbe onStore={(value) => (stores.child = value)} />
                <Dialog.Portal>
                  <Dialog.Popup data-testid="child">
                    <Dialog.Root open={grandchildOpen.value} modal={false}>
                      <DialogStoreProbe onStore={(value) => (stores.grandchild = value)} />
                    </Dialog.Root>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      return { result, stores, grandchildOpen };
    }

    it('marks a root in a root as nested', async () => {
      const { result, stores } = renderNested({ childOpen: true });
      await result;

      expect(stores.parent!.select('nested')).toBe(false);
      expect(stores.child!.select('nested')).toBe(true);
    });

    it('counts the open dialogs below a dialog', async () => {
      const { result, stores, grandchildOpen } = renderNested({ childOpen: true });
      await result;
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(1);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(0);

      grandchildOpen.value = true;
      await flushMicrotasks();
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(2);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(1);

      grandchildOpen.value = false;
      await flushMicrotasks();
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(1);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(0);
    });

    it('closes only the top dialog on the Escape key, also for a key press in the dialog above', async () => {
      const { result, stores } = renderNested({ childOpen: true });
      await result;

      await fireEvent.keyDown(screen.getByTestId('parent'), { key: 'Escape' });
      expect(screen.queryByTestId('child')).toBe(null);
      expect(screen.queryByTestId('parent')).not.toBe(null);
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(0);

      await fireEvent.keyDown(screen.getByTestId('parent'), { key: 'Escape' });
      expect(screen.queryByTestId('parent')).toBe(null);
    });

    it('closes one dialog for each outside press, the top one first', async () => {
      const { result } = renderNested({ childOpen: true });
      await result;
      const press = async () => {
        await fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
        await fireEvent.click(document.body, { detail: 1 });
      };

      await press();
      expect(screen.queryByTestId('child')).toBe(null);
      expect(screen.queryByTestId('parent')).not.toBe(null);

      await press();
      expect(screen.queryByTestId('parent')).toBe(null);
    });

    it('does not count a nested dialog when it unmounts while it is open', async () => {
      const show = shallowRef(true);
      let parent!: Store;
      await render(() => (
        <Dialog.Root defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          {show.value ? <Dialog.Root defaultOpen modal={false} /> : null}
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      show.value = false;
      await flushMicrotasks();

      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('ignores a nested dialog that opens while the dialog is closed', async () => {
      const handle = Dialog.createHandle();
      const childOpen = shallowRef(false);
      let parent!: Store;
      await render(() => (
        <Dialog.Root handle={handle} modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <Dialog.Root open={childOpen.value} modal={false} />
        </Dialog.Root>
      ));

      childOpen.value = true;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);

      handle.open(null);
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('forgets its count when it closes', async () => {
      const handle = Dialog.createHandle();
      let parent!: Store;
      await render(() => (
        <Dialog.Root handle={handle} defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
          <Dialog.Root open modal={false} />
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      handle.close();
      await flushMicrotasks();

      expect(parent.select('mounted')).toBe(false);
      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('does not count a nested dialog while KeepAlive holds it, and counts it again after', async () => {
      const show = shallowRef(true);
      let parent!: Store;
      const Child = defineComponent({
        name: 'Child',
        setup: () => () => <Dialog.Root defaultOpen modal={false} />,
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <Dialog.Root defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <KeepAlive>{show.value ? <Child key="child" /> : <Other key="other" />}</KeepAlive>
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      show.value = false;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);

      show.value = true;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(1);
    });
  });

  describe('scroll lock', () => {
    // The lock and the unlock each wait for a timer of 0 ms. The observers of `waitFor` do not see a
    // document in a frame, so it polls.
    const POLL = { interval: 5, timeout: 3000 };

    function renderModalDialog(scrollDocument: ScrollDocument, rootProps: object = {}) {
      return (
        <Dialog.Root defaultOpen {...rootProps}>
          <Dialog.Portal container={scrollDocument.body}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    it('locks the page while a modal dialog is open, and unlocks it when the dialog closes', async () => {
      const scrollDocument = await createScrollDocument();
      const handle = Dialog.createHandle();
      await render(() => renderModalDialog(scrollDocument, { handle }));
      await waitFor(() => expect(isScrollDocumentLocked(scrollDocument)).toBe(true), POLL);

      handle.close();
      await waitFor(() => expect(isScrollDocumentLocked(scrollDocument)).toBe(false), POLL);
      expect(getScrollLockRegistry()?.lockCount).toBe(0);
    });

    it.each([
      { name: 'modal false', modal: false },
      { name: "modal 'trap-focus'", modal: 'trap-focus' as const },
    ])('does not lock the page for $name', async ({ modal }) => {
      const scrollDocument = await createScrollDocument();
      await render(() => renderModalDialog(scrollDocument, { modal }));

      await wait(0);

      expect(isScrollDocumentLocked(scrollDocument)).toBe(false);
    });

    it('releases the lock while KeepAlive holds the dialog, and takes it back after', async () => {
      const scrollDocument = await createScrollDocument();
      const show = shallowRef(true);
      const ModalDialog = defineComponent({
        name: 'ModalDialog',
        setup: () => () => renderModalDialog(scrollDocument),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>{show.value ? <ModalDialog key="dialog" /> : <Other key="other" />}</KeepAlive>
      ));
      await waitFor(() => expect(isScrollDocumentLocked(scrollDocument)).toBe(true), POLL);

      show.value = false;
      await waitFor(() => expect(isScrollDocumentLocked(scrollDocument)).toBe(false), POLL);

      show.value = true;
      await waitFor(() => expect(isScrollDocumentLocked(scrollDocument)).toBe(true), POLL);
    });
  });

  describe('server render', () => {
    it('hydrates an open root with a nested root, with no message', async () => {
      const serverHtml = await renderOnServer('src/dialog/root/DialogRootHydration.test.vue', {});

      await hydrate(DialogRootHydration, { serverHtml });
    });
  });
});
