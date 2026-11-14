import { describe, expect, vi, it } from 'vitest';
import { defineComponent, provide, shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { platform } from '../../common/platform';
import { NumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';
import NumberFieldScrubAreaCursorReplace from './NumberFieldScrubAreaCursorReplace.test.vue';

const isWebKit = platform.engine.webkit;

const defaultScrubAreaContext: NumberFieldScrubAreaContext = {
  isScrubbing: shallowRef(true),
  isTouchInput: shallowRef(false),
  isPointerLockDenied: shallowRef(false),
  scrubAreaCursorRef: shallowRef<HTMLSpanElement | null>(null),
};

const ScrubAreaContextProvider = defineComponent((_, { slots }) => {
  provide(NumberFieldScrubAreaContext, defaultScrubAreaContext);
  return () => slots.default?.();
});

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.ScrubAreaCursor />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <ScrubAreaContextProvider>{node}</ScrubAreaContextProvider>
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );
    },
  }));

  it('has presentation role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).not.toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      await user.pointer({ target: firstScrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryAllByTestId('scrub-area-cursor')).toHaveLength(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    const { user } = await render(
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByRole('presentation');

    await user.pointer({ target: scrubArea, keys: '[TouchA>]', pointerName: 'touch' });
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      const requestLockStub = vi.fn(() => {
        throw new Error('User denied pointer lock');
      });
      Element.prototype.requestPointerLock =
        requestLockStub as typeof Element.prototype.requestPointerLock;

      const { user } = await render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByRole('presentation');

      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
      expect(requestLockStub).toHaveBeenCalled();
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      // Quick press and release (tap)
      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await user.pointer({ target: scrubArea, keys: '[/MouseLeft]', pointerName: 'mouse' });
      window.dispatchEvent(new Event('pointerup'));
      // Wait longer than the delayed pointer lock resolution
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('moves a cursor that mounts before the old cursor unmounts', async () => {
    const pointerLock = vi
      .spyOn(document.body, 'requestPointerLock')
      .mockImplementation(() => Promise.resolve());

    try {
      const swapped = shallowRef(false);
      await render(() => <NumberFieldScrubAreaCursorReplace swapped={swapped.value} />);

      const scrubArea = screen.getByTestId('scrub-area');
      scrubArea.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
      await flushMicrotasks();

      swapped.value = true;
      await flushMicrotasks();
      expect(screen.queryByTestId('old-cursor')).toBe(null);
      const cursor = screen.getByTestId('new-cursor');
      expect(cursor.style.transform).toBe('');

      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, movementX: 4 }));
      await flushMicrotasks();

      expect(cursor.style.transform).toContain('translate3d(14px,');
    } finally {
      pointerLock.mockRestore();
    }
  });

  // After a `setup` that throws, Vue 3.5.12 keeps the current instance set, so this case is last.
  it('throws a descriptive error when rendered outside <NumberField.ScrubArea>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        render(
          <NumberField.Root>
            <NumberField.ScrubAreaCursor />
          </NumberField.Root>,
        ),
      ).rejects.toThrow(
        'Vase UI: A part of the scrub area of Number Field must be inside <NumberField.ScrubArea>. Without a scrub area the part has no scrub to follow. Put the part inside <NumberField.ScrubArea>.',
      );

      // Vue also warns about the error of `setup`.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
