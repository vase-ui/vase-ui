import { defineComponent, shallowRef } from 'vue';
import type { VNode, VNodeChild } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { nextAnimationsRead } from './animation';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { waitSingleFrame } from './wait';

export interface PopupAnatomyTestProps {
  /** The controlled open state of the root. */
  open: boolean;
  onOpenChangeComplete: (open: boolean) => void;
  /** What the shown part holds, or what renders beside it when it holds no popup. */
  content: VNodeChild;
}

export interface PopupAnatomyTestConfig {
  /**
   * Returns the root with no popup part. The part that shows has `data-testid="shown"` and the
   * class `shown`.
   */
  createComponent: (props: PopupAnatomyTestProps) => VNode;
  /** Returns the popup part, for the case of a popup part that attaches after the open. */
  createPopup?: (() => VNode) | undefined;
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Whether the root emits `openChangeComplete` with `true`.
   * @default true
   */
  reportsOpen?: boolean | undefined;
}

// Resolves at the next call of the listener. The promise has no time limit, so a missing completion
// fails the test at its time limit.
function nextCompletion(onOpenChangeComplete: Mock) {
  return new Promise<void>((resolve) => {
    onOpenChangeComplete.mockImplementationOnce(() => resolve());
  });
}

function getShownPart() {
  return document.querySelector<HTMLElement>('[data-testid="shown"]');
}

function isShown(part: HTMLElement | null) {
  return part !== null && part.isConnected && !part.hidden;
}

/**
 * The cases of a root whose anatomy has no popup part. The positioner, or the backdrop of a dialog,
 * is then the part that shows. Its animations end each open change.
 */
export function popupAnatomyTests(config: PopupAnatomyTestConfig) {
  const { createComponent, createPopup, render, reportsOpen = true } = config;

  function renderAnatomy() {
    const open = shallowRef(false);
    const withPopup = shallowRef(false);
    const onOpenChangeComplete = vi.fn();
    const App = defineComponent(
      () => () =>
        createComponent({
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
    const completion = nextCompletion(onOpenChangeComplete);
    open.value = true;
    await completion;
  }

  describe('VUE-72: an anatomy with no popup part', () => {
    it('hides the shown part after the close and reports each completion one time', async () => {
      const { App, open, onOpenChangeComplete } = renderAnatomy();
      await render(<App />);

      await openAnatomy(open, onOpenChangeComplete);
      expect(isShown(getShownPart())).toBe(true);
      const completion = nextCompletion(onOpenChangeComplete);
      open.value = false;
      await completion;

      expect(isShown(getShownPart())).toBe(false);
      expect(onOpenChangeComplete.mock.calls).toEqual(reportsOpen ? [[true], [false]] : [[false]]);
    });

    it('waits for the exit animation of the shown part', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { App, open, onOpenChangeComplete } = renderAnatomy();
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

      const completion = nextCompletion(onOpenChangeComplete);
      for (const animation of animations) {
        animation.finish();
      }
      await completion;

      expect(isShown(getShownPart())).toBe(false);
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it.skipIf(createPopup === undefined)(
      'reports one open completion when the popup part attaches after it',
      async () => {
        const { App, open, withPopup, onOpenChangeComplete } = renderAnatomy();
        await render(<App />);
        await openAnatomy(open, onOpenChangeComplete);

        withPopup.value = true;
        await waitSingleFrame();
        await waitSingleFrame();
        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);

        const completion = nextCompletion(onOpenChangeComplete);
        open.value = false;
        await completion;
        expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
      },
    );
  });
}
