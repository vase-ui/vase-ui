import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  createTransitionRunCounter,
  flushMicrotasks,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { createKeptScene, scene } from '../../../../test/fixtures/popupViewportHarness';
import type {
  ViewportRootInstance,
  ViewportScene,
} from '../../../../test/fixtures/popupViewportHarness';
import type { Side } from '../../../internals/useAnchorPositioning';

const POPUP_STYLE = `
  [data-testid="popup"] {
    width: var(--popup-width);
    height: var(--popup-height);
    overflow: hidden;
    transition: width 300ms linear, height 300ms linear;
  }
`;

const SIZES: Record<string, { width: number; height: number }> = {
  narrow: { width: 120, height: 40 },
  wide: { width: 160, height: 60 },
  wider: { width: 200, height: 80 },
};

function sized(payload: unknown) {
  const { width, height } = SIZES[payload as string] ?? SIZES.narrow;
  return <div style={{ width: `${width}px`, height: `${height}px` }} />;
}

interface AnchoringCase {
  side: Side;
  direction: 'ltr' | 'rtl';
  expected: { position?: string; top?: string; right?: string; bottom?: string; left?: string };
}

function readVariable(element: HTMLElement, name: string) {
  return element.style.getPropertyValue(name);
}

// A change of the variable inside one task leaves no trace for a test. The variable of the first
// frame is the one that the CSS of the popup shows first.
function readInFirstFrame(name: string, action: () => void) {
  return new Promise<string>((resolve) => {
    requestAnimationFrame(() => {
      resolve(readVariable(screen.getByTestId('popup'), name));
    });
    action();
  });
}

describe('usePopupAutoResize', () => {
  const { render } = createRenderer();

  const openRoot = { defaultOpen: true, defaultTriggerId: 'trigger' };

  it.each([
    {
      side: 'top',
      direction: 'ltr',
      expected: { position: 'absolute', bottom: '0px', left: '0px' },
    },
    {
      side: 'top',
      direction: 'rtl',
      expected: { position: 'absolute', bottom: '0px', left: '0px' },
    },
    { side: 'bottom', direction: 'ltr', expected: {} },
    { side: 'bottom', direction: 'rtl', expected: {} },
    {
      side: 'left',
      direction: 'ltr',
      expected: { position: 'absolute', top: '0px', right: '0px' },
    },
    {
      side: 'left',
      direction: 'rtl',
      expected: { position: 'absolute', top: '0px', right: '0px' },
    },
    { side: 'right', direction: 'ltr', expected: {} },
    { side: 'right', direction: 'rtl', expected: {} },
    {
      side: 'inline-start',
      direction: 'ltr',
      expected: { position: 'absolute', top: '0px', right: '0px' },
    },
    { side: 'inline-start', direction: 'rtl', expected: {} },
    { side: 'inline-end', direction: 'ltr', expected: {} },
    {
      side: 'inline-end',
      direction: 'rtl',
      expected: { position: 'absolute', top: '0px', right: '0px' },
    },
  ] satisfies AnchoringCase[])(
    'anchors the popup for side=$side in $direction mode',
    async ({ side, direction, expected }) => {
      await render(() => (
        <DirectionProvider direction={direction}>
          {scene({
            root: openRoot,
            triggers: [{ id: 'trigger' }],
            positioner: { side, collisionAvoidance: { side: 'none' } },
            content: () => 'Content',
          })}
        </DirectionProvider>
      ));

      const { style } = screen.getByTestId('popup');
      expect(style.position).toBe(expected.position ?? '');
      expect(style.top).toBe(expected.top ?? '');
      expect(style.right).toBe(expected.right ?? '');
      expect(style.bottom).toBe(expected.bottom ?? '');
      expect(style.left).toBe(expected.left ?? '');
    },
  );

  describe('resize', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    // The popup is closed, and the test opens it with a click on the trigger.
    async function renderClosed(
      payload: { value: string },
      getOptions: () => Partial<ViewportScene> = () => ({}),
    ) {
      const counter = createTransitionRunCounter(() => true);
      const root = shallowRef<ViewportRootInstance | null>(null);
      const { user } = await render(() => (
        <div>
          <style>{POPUP_STYLE}</style>
          {scene({
            root: { ref: root },
            triggers: [{ id: 'trigger', payload: payload.value }],
            popup: { onTransitionrun: counter.onTransitionrun },
            content: sized,
            ...getOptions(),
          })}
        </div>
      ));
      const openPopup = () => screen.getByTestId('trigger1').click();
      return { user, counter, root, openPopup };
    }

    async function renderOpen(
      payload: { value: string },
      getOptions: () => Partial<ViewportScene> = () => ({}),
    ) {
      const result = await renderClosed(payload, getOptions);
      result.openPopup();
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toBeInTheDocument();
      });
      return result;
    }

    function recordVariable(element: HTMLElement, name: string) {
      const values = [readVariable(element, name)];
      const observer = new MutationObserver(() => {
        const value = readVariable(element, name);
        if (values.at(-1) !== value) {
          values.push(value);
        }
      });
      observer.observe(element, { attributes: true, attributeFilter: ['style'] });
      return { values, stop: () => observer.disconnect() };
    }

    it('gives the measured size to the positioner and leaves the popup at auto when the popup opens', async () => {
      const { counter, openPopup } = await renderClosed(shallowRef('narrow'));

      const popupWidth = await readInFirstFrame('--popup-width', openPopup);

      const popup = screen.getByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      expect(popupWidth).toBe('auto');
      expect(readVariable(popup, '--popup-height')).toBe('auto');
      expect(readVariable(positioner, '--positioner-width')).toBe('120px');
      expect(readVariable(positioner, '--positioner-height')).toBe('40px');
      await flushMicrotasks();
      expect(counter.counts).toEqual({ enter: 0, exit: 0 });
    });

    it('moves the popup size from the old size to the new size when the content changes', async () => {
      const payload = shallowRef('narrow');
      await renderOpen(payload);
      const popup = screen.getByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      const widths = recordVariable(popup, '--popup-width');

      payload.value = 'wide';

      await waitFor(() => {
        expect(widths.values).toEqual(['auto', '120px', '160px', 'auto']);
      });
      widths.stop();
      expect(readVariable(positioner, '--positioner-width')).toBe('160px');
      expect(readVariable(positioner, '--positioner-height')).toBe('60px');
    });

    it('ends with the size of the last content when a content change interrupts the resize', async () => {
      const payload = shallowRef('narrow');
      await renderOpen(payload);
      const popup = screen.getByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      const widths = recordVariable(popup, '--popup-width');
      payload.value = 'wide';
      await waitFor(() => {
        expect(widths.values).toEqual(['auto', '120px', '160px']);
      });

      payload.value = 'wider';

      await waitFor(() => {
        expect(widths.values).toEqual(['auto', '120px', '160px', '200px', 'auto']);
      });
      widths.stop();
      expect(readVariable(positioner, '--positioner-width')).toBe('200px');
      expect(readVariable(positioner, '--positioner-height')).toBe('80px');
    });

    it('treats the next open after a close as a first open', async () => {
      const payload = shallowRef('narrow');
      const { counter, root, openPopup } = await renderClosed(payload, () => ({
        keepMounted: true,
      }));
      openPopup();
      await waitFor(() => {
        expect(readVariable(screen.getByTestId('positioner'), '--positioner-width')).toBe('120px');
      });
      root.value!.close();
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('hidden');
      });
      payload.value = 'wide';

      const popupWidth = await readInFirstFrame('--popup-width', openPopup);

      expect(popupWidth).toBe('auto');
      expect(readVariable(screen.getByTestId('positioner'), '--positioner-width')).toBe('160px');
      await flushMicrotasks();
      expect(counter.counts).toEqual({ enter: 0, exit: 0 });
    });

    // A popup that stays mounted keeps the part, so only the cleanup of the run can cancel the frame.
    it('does not write the new size to a kept popup after a close that comes before the frame', async () => {
      const payload = shallowRef('narrow');
      const { root } = await renderOpen(payload, () => ({ keepMounted: true }));
      const popup = screen.getByTestId('popup');

      payload.value = 'wide';
      await nextTick();
      expect(readVariable(popup, '--popup-width')).toBe('120px');
      // Without animations, the popup counts as unmounted in the flush of the close.
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      root.value!.close();
      await waitSingleFrame();
      await waitSingleFrame();

      expect(popup).toHaveAttribute('hidden');
      expect(readVariable(popup, '--popup-width')).toBe('120px');
    });

    it('restores the inline style that the measurement changes', async () => {
      const payload = shallowRef('narrow');
      await renderOpen(payload, () => ({
        popup: { style: { position: 'relative', transform: 'translateX(3px)', scale: '1.5' } },
      }));
      const popup = screen.getByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      const expectRestored = () => {
        expect(popup.style.position).toBe('relative');
        expect(popup.style.transform).toBe('translateX(3px)');
        expect(popup.style.scale).toBe('1.5');
        expect(readVariable(positioner, '--available-width')).not.toBe('max-content');
        expect(readVariable(positioner, '--available-height')).not.toBe('max-content');
      };
      expectRestored();

      payload.value = 'wide';
      await waitFor(() => {
        expect(readVariable(positioner, '--positioner-width')).toBe('160px');
      });

      expectRestored();
    });

    it.each([
      { name: 'after the popup opens', changesContent: false },
      { name: 'after a change of the content', changesContent: true },
    ])(
      'removes the anchoring declarations when the side changes $name',
      async ({ changesContent }) => {
        const payload = shallowRef('narrow');
        const side = shallowRef<Side>('top');
        await renderOpen(payload, () => ({
          positioner: { side: side.value, collisionAvoidance: { side: 'none' } },
        }));
        const popup = screen.getByTestId('popup');
        if (changesContent) {
          payload.value = 'wide';
          await waitFor(() => {
            expect(readVariable(screen.getByTestId('positioner'), '--positioner-width')).toBe(
              '160px',
            );
          });
        }
        expect(popup.style.position).toBe('absolute');

        side.value = 'bottom';
        await flushMicrotasks();

        expect(popup.style.position).toBe('');
        expect(popup.style.bottom).toBe('');
        expect(popup.style.left).toBe('');
      },
    );
  });

  // The measurement stops what changes the size of a container while the popup measures.
  describe('measurement of the content', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    // The first measurement of a morph comes before the previous container has its content. A later
    // measurement, such as one for a payload that comes late, finds the old content there.
    it('measures the popup without the previous container, and shows it again', async () => {
      const payload = shallowRef<string | undefined>(undefined);
      const { user } = await render(() => (
        <div>
          <style>{`
            ${POPUP_STYLE}
            [data-previous] { position: static !important; }
            [data-transitioning] [data-previous],
            [data-transitioning] [data-current] { animation: fade 10s linear; }
            @keyframes fade { to { opacity: 0.5; } }
          `}</style>
          {scene({
            triggers: [{ payload: 'narrow' }, { payload: payload.value }],
            content: sized,
          })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(document.querySelector('[data-previous]')!.children).toHaveLength(1);
      });
      expect(readVariable(screen.getByTestId('positioner'), '--positioner-height')).toBe('40px');

      payload.value = 'wide';

      await waitFor(() => {
        expect(readVariable(screen.getByTestId('positioner'), '--positioner-height')).toBe('60px');
      });
      expect(document.querySelector<HTMLElement>('[data-previous]')!.style.display).toBe('');
    });

    it('measures the popup without the animation of the current container, and starts it after', async () => {
      await render(() => (
        <div>
          <style>{`
            [data-current] { animation: grow 10s linear; }
            @keyframes grow { from { height: 0; } to { height: 60px; } }
          `}</style>
          {scene({
            root: openRoot,
            triggers: [{ id: 'trigger' }],
            content: () => <div style={{ width: '160px', height: '60px' }} />,
          })}
        </div>
      ));

      const current = document.querySelector<HTMLElement>('[data-current]')!;
      expect(readVariable(screen.getByTestId('positioner'), '--positioner-height')).toBe('60px');
      expect(current.style.animation).toBe('');
      expect(current.getAnimations()).toHaveLength(1);
    });

    it('measures the popup without the transition of the current container', async () => {
      const payload = shallowRef('narrow');
      await render(() => (
        <div>
          <style>{`
            [data-current] { width: 120px; transition: width 10s linear; }
            [data-current]:has([data-wide]) { width: 160px; }
          `}</style>
          {scene({
            root: openRoot,
            triggers: [{ id: 'trigger', payload: payload.value }],
            content: (value) => (
              <div data-wide={value === 'wide' ? '' : undefined} style={{ height: '40px' }} />
            ),
          })}
        </div>
      ));
      const positioner = screen.getByTestId('positioner');
      expect(readVariable(positioner, '--positioner-width')).toBe('120px');

      payload.value = 'wide';

      await waitFor(() => {
        expect(readVariable(positioner, '--positioner-width')).toBe('160px');
      });
      expect(document.querySelector<HTMLElement>('[data-current]')!.style.transition).toBe('');
    });
  });

  describe('KeepAlive', () => {
    it('measures the popup when it comes back after a change of the payload', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const payload = shallowRef('narrow');
      const kept = createKeptScene(() => ({
        root: openRoot,
        triggers: [{ id: 'trigger', payload: payload.value }],
        content: sized,
      }));
      await render(() => (
        <div>
          <style>{POPUP_STYLE}</style>
          {kept.render()}
        </div>
      ));
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(readVariable(positioner, '--positioner-width')).toBe('120px');
      });

      kept.visible.value = false;
      await flushMicrotasks();
      payload.value = 'wide';
      await flushMicrotasks();

      // The detached elements have no layout, so a measurement would give 0.
      expect(readVariable(positioner, '--positioner-width')).toBe('120px');

      kept.visible.value = true;
      await flushMicrotasks();

      expect(readVariable(positioner, '--positioner-width')).toBe('160px');
    });
  });
});
