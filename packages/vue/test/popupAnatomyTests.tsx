import { defineAsyncComponent, defineComponent, shallowRef } from 'vue';
import type { VNode, VNodeChild } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { REASONS } from '../src/internals/reasons';
import { nextAnimationsRead } from './animation';
import type { createRenderer } from './createRenderer';
import { isScrollLocked } from './fixtures/scrollDocument';
import { flushMicrotasks } from './flushMicrotasks';
import { clientCenter, holdPress } from './pointer';
import { waitFor } from './waitFor';
import { waitSingleFrame } from './wait';

export interface PopupAnatomyTestProps {
  /** The controlled open state of the root. */
  open: boolean;
  onOpenChangeComplete: (open: boolean) => void;
  /** The popup part after it attaches, or `null`. Put it where the popup part goes. */
  content: VNodeChild;
}

// The component that the async component resolves to. It renders its default slot.
const Loaded = defineComponent({
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

export interface PendingPositionerTestProps {
  /**
   * An async component that renders its slot after the test loads it. Wrap the positioner, with
   * its popup part, in it.
   */
  Pending: typeof Loaded;
  onOpenChange: (open: boolean, details: { reason: string }) => void;
}

export interface PopupAnatomyTestConfig {
  /**
   * Returns the root with no popup part. The part that shows has `data-testid="shown"` and the
   * class `shown`.
   */
  createComponent: (props: PopupAnatomyTestProps) => VNode;
  /**
   * Returns the popup part with `data-testid="popup"`, for the case of a popup part that attaches
   * after the open.
   */
  createPopup?: (() => VNode) | undefined;
  /**
   * Returns the root with a backdrop part and no positioner. The backdrop has
   * `data-testid="shown"` and the class `shown`. The suite then runs its first two cases on that
   * root too.
   */
  createBackdropComponent?: ((props: PopupAnatomyTestProps) => VNode) | undefined;
  /**
   * Returns the root with a backdrop part and a positioner with no popup part. The positioner has
   * `data-testid="shown"` and the class `shown`. The backdrop has neither. The suite then asserts
   * that the close waits for the exit animation of the positioner.
   */
  createBackdropAndPositionerComponent?: ((props: PopupAnatomyTestProps) => VNode) | undefined;
  /**
   * Returns a modal root that is open at the mount, with a portal and no backdrop part. The portal
   * holds `Pending`, and the positioner is in it. The positioner has `data-testid="shown"`.
   */
  createPendingPositionerComponent?: ((props: PendingPositionerTestProps) => VNode) | undefined;
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Whether the root emits `openChangeComplete` with `true`.
   * @default true
   */
  reportsOpen?: boolean | undefined;
}

/**
 * Resolves at the next call of `mock`. The promise has no time limit, so a call that does not come
 * fails the test at the time limit of the test. Call it before the action.
 */
export function nextCall(mock: Mock) {
  return new Promise<void>((resolve) => {
    mock.mockImplementationOnce(() => resolve());
  });
}

function getShownPart() {
  return document.querySelector<HTMLElement>('[data-testid="shown"]');
}

function getPopup() {
  return document.querySelector<HTMLElement>('[data-testid="popup"]');
}

function isShown(part: HTMLElement | null) {
  return part !== null && part.isConnected && !part.hidden;
}

const INTERNAL_BACKDROP = '[role="presentation"][data-vase-ui-inert]';
const PORTAL = '[data-vase-ui-portal]';

// The page is one button, away from the trigger and from the popup.
const PAGE_STYLE = {
  position: 'fixed',
  left: '20px',
  top: '300px',
  width: '120px',
  height: '40px',
} as const;

async function press(element: Element) {
  const { release } = await holdPress(element);
  await release();
}

/**
 * The cases of a root whose anatomy has no popup part. The positioner, or else the backdrop, is
 * then the part that shows. Its animations end each open change.
 */
export function popupAnatomyTests(config: PopupAnatomyTestConfig) {
  const {
    createComponent,
    createPopup,
    createBackdropComponent,
    createBackdropAndPositionerComponent,
    createPendingPositionerComponent,
    render,
    reportsOpen = true,
  } = config;

  function createAnatomy(create = createComponent) {
    const open = shallowRef(false);
    const withPopup = shallowRef(false);
    const onOpenChangeComplete = vi.fn();
    const App = defineComponent(
      () => () =>
        create({
          open: open.value,
          onOpenChangeComplete,
          content: withPopup.value ? createPopup?.() : null,
        }),
    );
    return { App, open, withPopup, onOpenChangeComplete };
  }

  async function openAnatomy(open: { value: boolean }, onOpenChangeComplete: Mock) {
    if (!reportsOpen) {
      open.value = true;
      await flushMicrotasks();
      return;
    }
    const completion = nextCall(onOpenChangeComplete);
    open.value = true;
    await completion;
  }

  async function closeAndReport(create: PopupAnatomyTestConfig['createComponent']) {
    const { App, open, onOpenChangeComplete } = createAnatomy(create);
    await render(<App />);

    await openAnatomy(open, onOpenChangeComplete);
    expect(isShown(getShownPart())).toBe(true);
    const completion = nextCall(onOpenChangeComplete);
    open.value = false;
    await completion;

    expect(isShown(getShownPart())).toBe(false);
    expect(onOpenChangeComplete.mock.calls).toEqual(reportsOpen ? [[true], [false]] : [[false]]);
  }

  async function waitForExit(create: PopupAnatomyTestConfig['createComponent']) {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const { App, open, onOpenChangeComplete } = createAnatomy(create);
    await render(
      <>
        <style>{`@keyframes popup-anatomy-exit { to { opacity: 0.5 } } .shown[data-closed] { animation: popup-anatomy-exit 100s }`}</style>
        <App />
      </>,
    );
    await openAnatomy(open, onOpenChangeComplete);
    const part = getShownPart()!;

    const animations = await nextAnimationsRead(part, {
      action: () => {
        open.value = false;
      },
    });
    await flushMicrotasks();
    expect(animations).toHaveLength(1);
    expect(isShown(part)).toBe(true);
    expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

    const completion = nextCall(onOpenChangeComplete);
    for (const animation of animations) {
      animation.finish();
    }
    await completion;

    expect(isShown(getShownPart())).toBe(false);
    expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
  }

  describe('VUE-72: an anatomy with no popup part', () => {
    it('hides the shown part after the close and reports each completion one time', () =>
      closeAndReport(createComponent));

    it('waits for the exit animation of the shown part', () => waitForExit(createComponent));

    it.skipIf(createBackdropAndPositionerComponent === undefined)(
      'waits for the exit animation of the positioner, and not of the backdrop',
      () => waitForExit(createBackdropAndPositionerComponent!),
    );

    it.skipIf(createPopup === undefined)(
      'reports one open completion when the popup part attaches after it',
      async () => {
        const { App, open, withPopup, onOpenChangeComplete } = createAnatomy();
        await render(<App />);
        await openAnatomy(open, onOpenChangeComplete);

        withPopup.value = true;
        await waitSingleFrame();
        await waitSingleFrame();
        await flushMicrotasks();
        expect(isShown(getPopup())).toBe(true);
        expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);

        const completion = nextCall(onOpenChangeComplete);
        open.value = false;
        await completion;
        expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
      },
    );
  });

  describe.skipIf(createBackdropComponent === undefined)(
    'VUE-72: a backdrop with no positioner',
    () => {
      it('hides the shown part after the close and reports each completion one time', () =>
        closeAndReport(createBackdropComponent!));

      it('waits for the exit animation of the shown part', () =>
        waitForExit(createBackdropComponent!));
    },
  );

  describe.skipIf(createPendingPositionerComponent === undefined)(
    'VUE-61: a modal popup whose positioner has not mounted',
    () => {
      async function renderPending() {
        const onOpenChange = vi.fn();
        let load!: () => void;
        const loaded = new Promise<typeof Loaded>((resolve) => {
          load = () => resolve(Loaded);
        });
        const Pending = defineAsyncComponent(() => loaded);
        await render(
          <>
            <button type="button" data-testid="page" style={PAGE_STYLE}>
              Page
            </button>
            {createPendingPositionerComponent!({ Pending, onOpenChange })}
          </>,
        );
        await waitFor(() => {
          expect(document.querySelector(PORTAL)).not.toBe(null);
        });
        const page = document.querySelector<HTMLElement>('[data-testid="page"]')!;
        const { clientX, clientY } = clientCenter(page);
        return { page, load, onOpenChange, x: clientX, y: clientY };
      }

      function getChanges(onOpenChange: Mock) {
        return onOpenChange.mock.calls.map(([open, details]) => [open, details.reason]);
      }

      it('does not cover the page, and a press on the page closes the popup', async () => {
        const { page, onOpenChange, x, y } = await renderPending();

        expect(document.elementFromPoint(x, y)).toBe(page);
        await press(page);

        expect(getChanges(onOpenChange)).toEqual([[false, REASONS.outsidePress]]);
      });

      it('renders the internal backdrop and locks the scroll when the positioner mounts', async () => {
        const { page, load, onOpenChange, x, y } = await renderPending();
        expect(document.querySelector(INTERNAL_BACKDROP)).toBe(null);
        expect(isScrollLocked()).toBe(false);

        load();
        await waitFor(() => {
          expect(document.querySelector(INTERNAL_BACKDROP)).not.toBe(null);
        });
        await waitFor(() => {
          expect(isScrollLocked()).toBe(true);
        });

        expect(isShown(getShownPart())).toBe(true);
        expect(document.elementFromPoint(x, y)).toBe(document.querySelector(INTERNAL_BACKDROP));
        await press(page);
        expect(getChanges(onOpenChange)).toEqual([[false, REASONS.outsidePress]]);
      });
    },
  );
}
