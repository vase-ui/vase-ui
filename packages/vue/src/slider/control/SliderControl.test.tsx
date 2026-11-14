import { expect, describe, it, onTestFinished, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Slider } from '@vase-ui/vue/slider';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { ownerDocument } from '../../common/owner';
import { createTouches, getHorizontalSliderRect } from '../utils/test-utils';

// The mock calls through, so that a case can count the reads of the document.
vi.mock('../../common/owner', async () => {
  const actual = await vi.importActual<typeof import('../../common/owner')>('../../common/owner');
  return { ...actual, ownerDocument: vi.fn(actual.ownerDocument) };
});

describe('<Slider.Control />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Control />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('does not apply a tabIndex by default', async () => {
    await render(
      <Slider.Root defaultValue={50}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(screen.getByTestId('control')).not.toHaveAttribute('tabindex');
  });

  it('moves the first of several thumbs stacked at the maximum', async () => {
    const onValueChange = vi.fn();

    await render(
      <Slider.Root defaultValue={[100, 100, 100]} onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb-0" />
          <Slider.Thumb index={1} data-testid="thumb-1" />
          <Slider.Thumb index={2} data-testid="thumb-2" />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const lastThumb = screen.getByTestId('thumb-2');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(lastThumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(90, 0, 20, 10));

    await fireEvent.pointerDown(lastThumb, { buttons: 1, clientX: 100 });
    await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 50 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      [50, 100, 100],
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  it('clears the grabbed offset when swapping to a thumb that is not rendered', async () => {
    const onValueChange = vi.fn();

    await render(
      <Slider.Root
        defaultValue={[20, 40]}
        thumbCollisionBehavior="swap"
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    await fireEvent.pointerDown(thumb, { buttons: 1, clientX: 30 });
    await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 70 });
    await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      [40, 80],
      expect.objectContaining({ activeThumbIndex: 1, reason: 'drag' }),
    );
  });

  it('ignores a drag when collision behavior cannot satisfy the minimum distance', async () => {
    const onValueChange = vi.fn();

    await render(
      <Slider.Root
        value={[20, 40]}
        thumbCollisionBehavior="none"
        minStepsBetweenValues={50}
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    await fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 20 });
    await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'horizontal',
      orientation: 'horizontal' as const,
      controlRect: new DOMRect(0, 0, 100, 10),
      thumbRect: new DOMRect(40, 0, 20, 10),
      pointer: { clientX: 10, clientY: 5 },
    },
    {
      name: 'vertical',
      orientation: 'vertical' as const,
      controlRect: new DOMRect(0, 0, 10, 100),
      thumbRect: new DOMRect(0, 40, 10, 20),
      pointer: { clientX: 5, clientY: 90 },
    },
  ])(
    'accounts for the thumb size when pressing an inset $name control',
    async ({ orientation, controlRect, thumbRect, pointer }) => {
      const onValueChange = vi.fn();

      await render(
        <Slider.Root
          defaultValue={50}
          orientation={orientation}
          thumbAlignment="edge-client-only"
          onValueChange={onValueChange}
        >
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(controlRect);
      vi.spyOn(screen.getByTestId('thumb'), 'getBoundingClientRect').mockReturnValue(thumbRect);

      await fireEvent.pointerDown(control, { button: 0, buttons: 1, ...pointer });

      expect(onValueChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ activeThumbIndex: 0, reason: 'track-press' }),
      );
    },
  );

  it('preserves single-element array values on track press', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <Slider.Root
        defaultValue={[25]}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    Object.defineProperties(control, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => false },
    });

    await fireEvent.pointerDown(control, { button: 0, buttons: 1, clientX: 50 });
    await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 50 });

    expect(onValueChange.mock.calls[0][0]).toEqual([50]);
    expect(onValueCommitted.mock.calls[0][0]).toEqual([50]);
  });

  it('releases pointer capture when the interaction ends', async () => {
    await render(
      <Slider.Root defaultValue={20}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    const releasePointerCapture = vi.fn();
    Object.defineProperties(control, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => true },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    await fireEvent.pointerDown(control, {
      pointerId: 7,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 40,
    });
    await fireEvent.pointerUp(document.body, {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 40,
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('degrades safely when a custom render function drops the control ref', async () => {
    const onValueChange = vi.fn();
    const { unmount } = await render(
      <Slider.Root defaultValue={20} onValueChange={onValueChange}>
        <Slider.Control
          data-testid="control"
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <div {...props} ref={undefined}>
                <Slider.Thumb />
              </div>
            ),
          }}
        />
      </Slider.Root>,
    );

    await fireEvent.pointerDown(screen.getByTestId('control'), {
      button: 0,
      buttons: 1,
      clientX: 80,
    });
    expect(onValueChange).not.toHaveBeenCalled();

    // A development build warns that the part has no element.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('The `#render` slot gave no element to the part.'),
    ]);

    unmount();
  });

  it.skipIf(isJSDOM || typeof Touch === 'undefined')(
    'handles touch interactions that originate on a text node',
    async () => {
      const onValueChange = vi.fn();

      await render(
        <Slider.Root defaultValue={20} onValueChange={onValueChange}>
          <Slider.Control data-testid="control">
            <span data-testid="track-text">Track</span>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
      const textNode = screen.getByTestId('track-text').firstChild!;

      await fireEvent.touchStart(
        textNode,
        createTouches([{ identifier: 1, clientX: 60, clientY: 0 }]),
      );

      expect(onValueChange).toHaveBeenCalledWith(
        60,
        expect.objectContaining({ activeThumbIndex: 0, reason: 'track-press' }),
      );
    },
  );

  it.skipIf(isJSDOM || typeof Touch === 'undefined')(
    'ignores touch interactions when no thumbs are composed',
    async () => {
      const onValueChange = vi.fn();

      await render(
        <Slider.Root
          defaultValue={20}
          thumbAlignment="edge-client-only"
          onValueChange={onValueChange}
        >
          <Slider.Control data-testid="control" />
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      await fireEvent.touchStart(
        control,
        createTouches([{ identifier: 1, clientX: 60, clientY: 0 }]),
      );
      await fireEvent.touchMove(
        document.body,
        createTouches([{ identifier: 1, clientX: 80, clientY: 0 }]),
      );

      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  describe('cancelled gestures', () => {
    async function renderCancelTestSlider() {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      const TestSlider = defineComponent(
        (props: { disabled?: boolean }) => () => (
          <>
            <Slider.Root
              disabled={props.disabled}
              defaultValue={20}
              onValueChange={onValueChange}
              onValueCommitted={onValueCommitted}
            >
              <Slider.Control data-testid="control">
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
            <div data-testid="elsewhere" />
          </>
        ),
        { props: ['disabled'] },
      );

      const { setProps } = await render(<TestSlider />);

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
      Object.defineProperties(control, {
        setPointerCapture: { configurable: true, value: vi.fn() },
        hasPointerCapture: { configurable: true, value: () => false },
        releasePointerCapture: { configurable: true, value: vi.fn() },
      });

      return {
        control,
        elsewhere: screen.getByTestId('elsewhere'),
        onValueChange,
        onValueCommitted,
        setProps,
      };
    }

    it.skipIf(isJSDOM || typeof Touch === 'undefined').each(['touchEnd', 'touchCancel'] as const)(
      'ignores %s from another finger during a touch drag',
      async (eventName) => {
        const { control, elsewhere, onValueChange, onValueCommitted } =
          await renderCancelTestSlider();
        const pointer = { pointerId: 1, pointerType: 'touch' };
        const firstTouch = createTouches([{ identifier: 1, clientX: 40, clientY: 0 }]);
        const secondTouch = createTouches([{ identifier: 2, clientX: 90, clientY: 0 }]);

        await fireEvent.pointerDown(control, { ...pointer, button: 0, buttons: 1, clientX: 40 });
        await fireEvent.touchStart(control, firstTouch);
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]),
        );
        await fireEvent.touchStart(elsewhere, secondTouch);
        await fireEvent[eventName](elsewhere, secondTouch);

        expect(onValueCommitted).not.toHaveBeenCalled();
        expect(control).toHaveAttribute('data-dragging', '');

        const lastTouch = createTouches([{ identifier: 1, clientX: 80, clientY: 0 }]);
        await fireEvent.touchMove(document.body, lastTouch);
        expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(80);

        await fireEvent.touchCancel(document.body, lastTouch);
        expect(onValueCommitted).toHaveBeenCalledExactlyOnceWith(
          80,
          expect.objectContaining({ reason: 'drag' }),
        );
        expect(control).not.toHaveAttribute('data-dragging');
      },
    );

    it.skipIf(isJSDOM || typeof Touch === 'undefined').each(['mouse', 'pen'])(
      'ends a cancelled %s drag after disabling and re-enabling during a touch drag',
      async (pointerType) => {
        const { control, elsewhere, onValueChange, onValueCommitted, setProps } =
          await renderCancelTestSlider();

        await fireEvent.pointerDown(control, {
          pointerId: 1,
          pointerType: 'touch',
          button: 0,
          buttons: 1,
          clientX: 40,
        });
        const touches = createTouches([{ identifier: 1, clientX: 40, clientY: 0 }]);
        await fireEvent.touchStart(control, touches);
        await setProps({ disabled: true });
        await fireEvent.touchCancel(document.body, touches);
        await setProps({ disabled: false });

        const pointer = { pointerId: 7, pointerType };
        await fireEvent.pointerDown(control, { ...pointer, button: 0, buttons: 1, clientX: 50 });
        await fireEvent.pointerMove(document.body, { ...pointer, buttons: 1, clientX: 70 });
        await fireEvent.pointerCancel(document.body, pointer);

        expect(onValueCommitted).toHaveBeenCalledExactlyOnceWith(
          70,
          expect.objectContaining({ reason: 'drag' }),
        );
        expect(control).not.toHaveAttribute('data-dragging');

        onValueChange.mockClear();
        await fireEvent.pointerMove(elsewhere, { ...pointer, buttons: 1, clientX: 90 });
        await fireEvent.pointerUp(elsewhere, { ...pointer, buttons: 0, clientX: 90 });
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueCommitted).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['mouse', 'pen'])(
      'commits and ends a %s drag on pointercancel',
      async (pointerType) => {
        const { control, elsewhere, onValueChange, onValueCommitted } =
          await renderCancelTestSlider();
        const pointer = { pointerId: 7, pointerType };

        await fireEvent.pointerDown(control, { ...pointer, button: 0, buttons: 1, clientX: 40 });
        await fireEvent.pointerMove(document.body, { ...pointer, buttons: 1, clientX: 70 });
        expect(control).toHaveAttribute('data-dragging', '');

        await fireEvent.pointerCancel(document.body, pointer);

        expect(onValueCommitted.mock.calls.length).toBe(1);
        expect(onValueCommitted.mock.calls[0][0]).toBe(70);
        expect(control).not.toHaveAttribute('data-dragging');

        onValueChange.mockClear();
        await fireEvent.pointerDown(elsewhere, {
          ...pointer,
          button: 0,
          buttons: 1,
          clientX: 90,
        });
        await fireEvent.pointerMove(elsewhere, { ...pointer, buttons: 1, clientX: 90 });
        await fireEvent.pointerUp(elsewhere, { ...pointer, buttons: 0, clientX: 90 });

        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueCommitted.mock.calls.length).toBe(1);
      },
    );

    it.skipIf(isJSDOM || typeof Touch === 'undefined')(
      'keeps a touch drag going after pointercancel and commits and ends it on touchcancel',
      async () => {
        const { control, elsewhere, onValueChange, onValueCommitted } =
          await renderCancelTestSlider();
        const pointer = { pointerId: 1, pointerType: 'touch' };

        await fireEvent.pointerDown(control, { ...pointer, button: 0, buttons: 1, clientX: 40 });
        await fireEvent.touchStart(
          control,
          createTouches([{ identifier: 1, clientX: 40, clientY: 0 }]),
        );
        // Without `touch-action: none`, the browser cancels the pointer once it starts panning.
        await fireEvent.pointerCancel(document.body, pointer);
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]),
        );

        expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(70);

        await fireEvent.touchCancel(
          document.body,
          createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]),
        );

        expect(onValueCommitted.mock.calls.length).toBe(1);
        expect(onValueCommitted.mock.calls[0][0]).toBe(70);
        expect(control).not.toHaveAttribute('data-dragging');

        onValueChange.mockClear();
        const touches = createTouches([{ identifier: 2, clientX: 90, clientY: 0 }]);
        await fireEvent.pointerDown(elsewhere, { pointerId: 2, pointerType: 'touch', buttons: 1 });
        await fireEvent.touchStart(elsewhere, touches);
        await fireEvent.touchMove(document.body, touches);
        await fireEvent.pointerUp(elsewhere, { pointerId: 2, pointerType: 'touch', buttons: 0 });
        await fireEvent.touchEnd(document.body, touches);

        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueCommitted.mock.calls.length).toBe(1);
      },
    );
  });

  it.skipIf(isJSDOM)(
    'does not resurrect a removed thumb value when the range shrinks mid-drag',
    async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef([10, 20, 30]);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                value.value = [10, 20];
              }}
            >
              shrink
            </button>
            <Slider.Root
              value={value.value}
              min={0}
              max={100}
              onValueChange={onValueChange}
              onValueCommitted={onValueCommitted}
            >
              <Slider.Control data-testid="control">
                {value.value.map((_, index) => (
                  <Slider.Thumb key={index} index={index} data-testid={`thumb-${index}`} />
                ))}
              </Slider.Control>
            </Slider.Root>
          </>
        );
      });

      await render(<App />);

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      // Press the last thumb so the pressed index points at index 2.
      await fireEvent.pointerDown(screen.getByTestId('thumb-2'), { buttons: 1, clientX: 30 });

      // Cache a committed drag value before the range shrinks.
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 50 });
      expect(onValueChange).toHaveBeenCalledWith(
        [10, 20, 100],
        expect.objectContaining({ reason: 'drag' }),
      );

      // Shrink the value array while the pointer is still down, removing index 2.
      // `fireEvent.click` avoids dispatching a `pointerup` that would end the drag.
      await fireEvent.click(screen.getByRole('button', { name: 'shrink' }));
      await waitFor(() => {
        expect(screen.getAllByRole('slider')).toHaveLength(2);
      });

      onValueChange.mockClear();
      onValueCommitted.mockClear();

      // A subsequent move must not write past the end of the shrunken array.
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 50 });
      await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 50 });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    },
  );

  // Requires layout: the range drag relies on real thumb measurements.
  it.skipIf(isJSDOM)(
    'does not commit a stale value when the range shrinks mid-drag and the pressed thumb stays valid',
    async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef([10, 20, 30]);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                value.value = [10, 20];
              }}
            >
              shrink
            </button>
            <Slider.Root
              value={value.value}
              min={0}
              max={100}
              onValueChange={onValueChange}
              onValueCommitted={onValueCommitted}
            >
              <Slider.Control data-testid="control">
                {value.value.map((_, index) => (
                  <Slider.Thumb key={index} index={index} data-testid={`thumb-${index}`} />
                ))}
              </Slider.Control>
            </Slider.Root>
          </>
        );
      });

      await render(<App />);

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      // Press the middle thumb so the pressed index (1) stays in range after the shrink.
      await fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 20 });

      // Cache a 3-element drag value before the range shrinks.
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      expect(onValueChange).toHaveBeenCalled();
      expect(onValueChange.mock.calls.at(-1)?.[0]).toHaveLength(3);

      // Shrink the value array while the pointer is still down. Index 1 is still valid,
      // so the pressed-index guard alone would not invalidate the cached 3-element array.
      await fireEvent.click(screen.getByRole('button', { name: 'shrink' }));
      await waitFor(() => {
        expect(screen.getAllByRole('slider')).toHaveLength(2);
      });

      onValueChange.mockClear();
      onValueCommitted.mockClear();

      // Releasing without a reconciling move must not commit the now-mismatched array.
      await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 40 });

      expect(onValueCommitted).not.toHaveBeenCalled();
    },
  );

  // Requires layout: the range drag relies on real thumb measurements.
  it.skipIf(isJSDOM)(
    'clears cached interaction state when the controlled range grows mid-drag',
    async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef([10, 20]);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                value.value = [10, 20, 30];
              }}
            >
              grow
            </button>
            <Slider.Root
              value={value.value}
              min={0}
              max={100}
              onValueChange={(nextValue: number[], details: Slider.Root.ChangeEventDetails) => {
                onValueChange(nextValue, details);
                value.value = nextValue;
              }}
              onValueCommitted={onValueCommitted}
            >
              <Slider.Control data-testid="control">
                {value.value.map((_, index) => (
                  <Slider.Thumb key={index} index={index} data-testid={`thumb-${index}`} />
                ))}
              </Slider.Control>
            </Slider.Root>
          </>
        );
      });

      await render(<App />);

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      await fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 20 });
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      await fireEvent.click(screen.getByRole('button', { name: 'grow' }));
      await waitFor(() => {
        expect(screen.getAllByRole('slider')).toHaveLength(3);
      });

      onValueChange.mockClear();
      onValueCommitted.mockClear();
      await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 40 });

      expect(onValueCommitted).not.toHaveBeenCalled();

      await fireEvent.pointerDown(screen.getByTestId('thumb-2'), { buttons: 1, clientX: 30 });
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });
      await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 80 });

      const nextValue = onValueChange.mock.lastCall?.[0];
      expect(nextValue).toEqual([10, 20, 100]);
      expect(onValueCommitted).toHaveBeenCalledWith(
        nextValue,
        expect.objectContaining({ reason: 'drag' }),
      );
    },
  );

  it('adds its touchstart listener as a passive listener', async () => {
    const addEventListener = vi.spyOn(EventTarget.prototype, 'addEventListener');
    onTestFinished(() => addEventListener.mockRestore());

    await render(
      <Slider.Root>
        <Slider.Control data-testid="control" />
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const touchstartOptions = addEventListener.mock.calls
      .filter(
        ([type], index) =>
          type === 'touchstart' && addEventListener.mock.contexts[index] === control,
      )
      .map(([, , options]) => options);

    expect(touchstartOptions).toEqual([{ passive: true }]);
  });

  // With Vue 3.6, a server also runs the cleanup of `onScopeDispose`, and a server has no document.
  it('reads no document when it unmounts with no gesture in progress', async () => {
    const { unmount } = await render(
      <Slider.Root>
        <Slider.Control />
      </Slider.Root>,
    );
    vi.mocked(ownerDocument).mockClear();

    unmount();

    expect(ownerDocument).not.toHaveBeenCalled();
  });

  it('VUE-27: starts and ends a drag for a pointer that the browser does not know', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <Slider.Root
        defaultValue={20}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <Slider.Control data-testid="control" style={{ width: '100px', height: '10px' }}>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    // A browser throws `NotFoundError` for the pointer of an event that a script dispatched.
    vi.spyOn(control, 'setPointerCapture').mockImplementation(() => {
      throw new DOMException('No active pointer has this id.', 'NotFoundError');
    });
    const { left, top } = control.getBoundingClientRect();

    await fireEvent.pointerDown(control, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: left + 40,
      clientY: top + 5,
    });
    expect(control).toHaveAttribute('data-dragging');

    await fireEvent.pointerMove(document.body, {
      pointerId: 1,
      buttons: 1,
      clientX: left + 80,
      clientY: top + 5,
    });
    expect(onValueChange).toHaveBeenLastCalledWith(
      80,
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );

    await fireEvent.pointerUp(document.body, {
      pointerId: 1,
      buttons: 0,
      clientX: left + 80,
      clientY: top + 5,
    });
    expect(control).not.toHaveAttribute('data-dragging');
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenCalledWith(80, expect.objectContaining({ reason: 'drag' }));
  });

  it('VUE-28: reads the border and the padding again when `as` gives the control a new element', async () => {
    const as = shallowRef('div');
    const onValueChange = vi.fn();

    await render(() => (
      <Slider.Root defaultValue={0} onValueChange={onValueChange}>
        <Slider.Control
          as={as.value}
          data-testid="control"
          style={{
            boxSizing: 'border-box',
            width: '200px',
            height: '20px',
            paddingInlineStart: '50px',
          }}
        >
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    const firstElement = screen.getByTestId('control');
    as.value = 'section';
    await flushMicrotasks();

    const control = screen.getByTestId('control');
    expect(control.localName).toBe('section');
    expect(control).not.toBe(firstElement);

    // The padding takes the first 50px, so the value area is 150px wide. 125px is the middle of it.
    const { left, top } = control.getBoundingClientRect();
    await fireEvent.pointerDown(control, {
      button: 0,
      buttons: 1,
      clientX: left + 125,
      clientY: top + 10,
    });

    expect(onValueChange).toHaveBeenCalledWith(
      50,
      expect.objectContaining({ activeThumbIndex: 0, reason: 'track-press' }),
    );
  });

  describe('KeepAlive', () => {
    it('ends a drag that is in progress when KeepAlive deactivates the control', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const visible = shallowRef(true);
      const Content = defineComponent(() => () => (
        <Slider.Root
          defaultValue={[20, 80]}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <Slider.Control data-testid="control" style={{ width: '200px', height: '10px' }}>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Content /> : null}</KeepAlive>
      ));
      await render(<App />);
      const control = screen.getByTestId('control');

      await fireEvent.pointerDown(control, { button: 0, buttons: 1, clientX: 100, clientY: 5 });
      expect(control).toHaveAttribute('data-dragging');
      expect(onValueChange).toHaveBeenCalledTimes(1);

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(control).not.toHaveAttribute('data-dragging');
      // The listeners of the press are gone, so the release of the pointer commits nothing.
      await fireEvent.pointerUp(document.body, { buttons: 0, clientX: 100, clientY: 5 });
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('finds its thumbs again when KeepAlive shows the control again', async () => {
      const onValueChange = vi.fn();
      const visible = shallowRef(true);
      const Content = defineComponent(() => () => (
        <Slider.Root defaultValue={[20, 80]} onValueChange={onValueChange}>
          <Slider.Control
            data-testid="control"
            style={{ position: 'relative', width: '200px', height: '10px' }}
          >
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Content /> : null}</KeepAlive>
      ));
      await render(<App />);

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      // A press on the control moves the thumb that is nearest to the press.
      const control = screen.getByTestId('control');
      const { left, top } = control.getBoundingClientRect();
      await fireEvent.pointerDown(control, {
        button: 0,
        buttons: 1,
        clientX: left + 140,
        clientY: top + 5,
      });

      expect(onValueChange).toHaveBeenLastCalledWith(
        [20, 70],
        expect.objectContaining({ activeThumbIndex: 1, reason: 'track-press' }),
      );
    });
  });

  it('throws a descriptive error when rendered outside <Slider.Root>', async () => {
    await expect(render(<Slider.Control />)).rejects.toThrow(
      'Vase UI: A part of Slider must be inside <Slider.Root>. Without a root the part has no value to show or to change. Put the part inside <Slider.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
