import { expect, describe, it, vi, afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { CDPSession } from '@vitest/browser-playwright';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Slider } from '@vase-ui/vue/slider';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import { platform } from '../../common/platform';
import { REASONS } from '../../internals/reasons';
import {
  ARROW_RIGHT,
  ARROW_LEFT,
  ARROW_UP,
  ARROW_DOWN,
  HOME,
  END,
} from '../../internals/composite/composite';
import type { Orientation } from '../../internals/types';
import { createTouches, getHorizontalSliderRect } from '../utils/test-utils';
import SliderRootHydration from './SliderRootHydration.test.vue';

const isWebKit = platform.engine.webkit;
const isBlink = platform.engine.blink;

const USD_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
};

// The browser resets the controls after the listeners of the event, and the slider follows the
// reset in a 0 ms timeout.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

describe('<Slider.Root />', () => {
  const pointerCaptureMethods = [
    'setPointerCapture',
    'hasPointerCapture',
    'releasePointerCapture',
  ] as const;
  const pointerCaptureDescriptors = pointerCaptureMethods.map((method) =>
    Object.getOwnPropertyDescriptor(Element.prototype, method),
  );

  beforeAll(() => {
    // Synthetic pointer events have no active pointer to capture. Preserve PointerEvent so
    // gesture tests still exercise their pointerType and pointerId.
    pointerCaptureMethods.forEach((method) => {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        value: vi.fn(() => false),
      });
    });
  });

  afterAll(() => {
    pointerCaptureMethods.forEach((method, index) => {
      const descriptor = pointerCaptureDescriptors[index];
      if (descriptor) {
        Object.defineProperty(Element.prototype, method, descriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, method);
      }
    });
  });

  const { render } = createRenderer();

  describeConformance(<Slider.Root defaultValue={50} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('hydration', () => {
    it('hydrates a root that names a label that does not exist, and the root then names none', async () => {
      const props = { id: 'volume', defaultValue: 30 };
      const serverHtml = await renderOnServer(
        'src/slider/root/SliderRootHydration.test.vue',
        props,
      );

      // A server cannot know that no label comes, so the root names the id that a label would have.
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('[role="group"]')?.getAttribute('aria-labelledby'),
      ).toBe('volume-label');

      const { container } = await hydrate(SliderRootHydration, { serverHtml, props });

      expect(within(container).getByRole('group')).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('prop: disabled', () => {
    it('does not drag a thumb disabled via the `disabled` prop', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Slider.Root defaultValue={[20, 80]} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const disabledInput = screen.getByTestId('thumb-1').querySelector('input')!;
      expect(disabledInput).toBeDisabled();

      await fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 80 });
      await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      await fireEvent.pointerUp(document.body, { buttons: 1, clientX: 40 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });

    it.skipIf(isJSDOM || isWebKit)('does not drag a disabled thumb with touch events', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Slider.Root defaultValue={[20, 80]} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const [enabledInput, disabledInput] = screen.getAllByRole('slider');
      expect(disabledInput).toBeDisabled();

      await fireEvent.touchStart(
        screen.getByTestId('thumb-1'),
        createTouches([{ identifier: 1, clientX: 80, clientY: 0 }]),
      );
      await fireEvent.touchMove(
        document.body,
        createTouches([{ identifier: 1, clientX: 40, clientY: 0 }]),
      );
      await fireEvent.touchEnd(
        document.body,
        createTouches([{ identifier: 1, clientX: 40, clientY: 0 }]),
      );

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(enabledInput).toHaveAttribute('aria-valuenow', '20');
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });

    it('does not change a single disabled thumb when pressing the track', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Slider.Root defaultValue={20} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb disabled />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const input = screen.getByRole('slider');
      expect(input).toBeDisabled();

      await fireEvent.pointerDown(control, { buttons: 1, clientX: 80 });
      await fireEvent.pointerUp(control, { buttons: 1, clientX: 80 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-valuenow', '20');
    });

    // Requires layout: track-press picks the closest thumb from measurements.
    it.skipIf(isJSDOM)('does not select a disabled thumb when pressing the track', async () => {
      await render(
        <Slider.Root
          defaultValue={[20, 80]}
          thumbCollisionBehavior="none"
          style={{ width: '1000px' }}
        >
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(() =>
        getHorizontalSliderRect(1000),
      );

      const [, disabledInput] = screen.getAllByRole('slider');
      expect(disabledInput).toBeDisabled();

      // Press the track closest to the disabled thumb (rendered around 800px).
      await fireEvent.pointerDown(control, { buttons: 1, clientX: 950 });
      await fireEvent.pointerUp(control, { buttons: 1, clientX: 950 });

      // The enabled thumb is selected instead, so the disabled thumb stays put.
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });

    it('does not keep the focus on a thumb that becomes disabled', async () => {
      const disabled = shallowRef(false);
      await render(() => (
        <Slider.Root defaultValue={30} disabled={disabled.value}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      const input = screen.getByRole('slider');
      input.focus();
      expect(input).toHaveFocus();

      disabled.value = true;
      await flushMicrotasks();

      expect(input).not.toHaveFocus();
    });
  });

  describe('prop: onValueCommitted', () => {
    it('single value', async () => {
      const handleValueCommitted = vi.fn(
        (newValue: number, eventDetails: Slider.Root.CommitEventDetails) => ({
          newValue,
          reason: eventDetails.reason,
        }),
      );

      await render(
        <Slider.Root onValueCommitted={handleValueCommitted} defaultValue={0}>
          <Slider.Control data-testid="control">
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const slider = screen.getByRole('slider');

      await fireEvent.pointerDown(sliderControl, {
        buttons: 1,
        clientX: 10,
      });
      await fireEvent.pointerUp(sliderControl, {
        buttons: 1,
        clientX: 10,
      });

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.results.at(-1)?.value.newValue).toBe(10);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.trackPress);

      slider.focus();
      await flushMicrotasks();

      await fireEvent.change(slider, { target: { value: 23 } });
      expect(handleValueCommitted.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
    });

    it.each(['touch', 'pen'])('commits a %s track tap', async (pointerType) => {
      const handleValueCommitted = vi.fn();

      const ControlledSlider = defineComponent(() => {
        const value = shallowRef(0);
        return () => (
          <Slider.Root
            value={value.value}
            onValueChange={(newValue: number) => {
              value.value = newValue;
            }}
            onValueCommitted={handleValueCommitted}
          >
            <Slider.Control data-testid="control">
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        );
      });

      await render(<ControlledSlider />);

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const touches = createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]);

      // Browsers fire pointer events before the compatibility touch events, including for
      // Apple Pencil.
      await fireEvent.pointerDown(sliderControl, {
        pointerType,
        pointerId: 1,
        buttons: 1,
        clientX: 50,
      });
      await fireEvent.touchStart(sliderControl, touches);
      await fireEvent.pointerUp(sliderControl, { pointerType, pointerId: 1, clientX: 50 });
      await fireEvent.touchEnd(document.body, touches);

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(50);
    });

    // Real touch input, so the browser decides the pointer and compatibility touch event order.
    it.skipIf(isJSDOM || !isBlink)('commits a real touch track tap', async () => {
      const { cdp } = await import('vitest/browser');
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root defaultValue={0} onValueCommitted={handleValueCommitted}>
          <Slider.Control data-testid="control" style={{ width: '200px', height: '20px' }}>
            <Slider.Thumb style={{ width: '10px', height: '10px' }} />
          </Slider.Control>
        </Slider.Root>,
      );

      const rect = screen.getByTestId('control').getBoundingClientRect();
      // The tester renders inside a scaled iframe, and CDP takes top-level page coordinates.
      const frameRect = window.frameElement?.getBoundingClientRect() ?? new DOMRect();
      const scale = frameRect.width / window.innerWidth || 1;
      const touchPoints = [
        {
          x: frameRect.left + (rect.left + rect.width / 2) * scale,
          y: frameRect.top + (rect.top + rect.height / 2) * scale,
        },
      ];

      const session = cdp() as CDPSession;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

      await waitFor(() => {
        expect(handleValueCommitted.mock.calls.length).toBe(1);
      });
      expect(handleValueCommitted.mock.calls[0][0]).toBe(50);
    });

    it('keeps tracking a touch drag with touch listeners after the browser cancels the pointer', async () => {
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root defaultValue={0} onValueCommitted={handleValueCommitted}>
          <Slider.Control data-testid="control">
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      await fireEvent.pointerDown(sliderControl, {
        pointerType: 'touch',
        pointerId: 1,
        buttons: 1,
        clientX: 50,
      });
      await fireEvent.touchStart(
        sliderControl,
        createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]),
      );
      // Without `touch-action: none`, the browser cancels the pointer once it starts panning.
      await fireEvent.pointerCancel(sliderControl, { pointerType: 'touch', pointerId: 1 });
      await fireEvent.touchMove(
        document.body,
        createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]),
      );
      await fireEvent.touchEnd(
        document.body,
        createTouches([{ identifier: 1, clientX: 70, clientY: 0 }]),
      );

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.calls[0][0]).toBe(70);
    });

    it.each(['mouse', 'pen', 'touch'])(
      'handles a touch press normally after a cancelled %s gesture',
      async (pointerType) => {
        const handleValueChange = vi.fn();
        const handleValueCommitted = vi.fn();
        let preventPointerDown = false;

        await render(
          <Slider.Root
            defaultValue={0}
            onValueChange={handleValueChange}
            onValueCommitted={handleValueCommitted}
          >
            <Slider.Control
              data-testid="control"
              onPointerdown={(event: PointerEvent) => {
                if (preventPointerDown) {
                  event.preventDefault();
                }
              }}
            >
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');
        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );

        await fireEvent.pointerDown(sliderControl, {
          pointerType,
          pointerId: 1,
          buttons: 1,
          clientX: 50,
        });
        if (pointerType === 'touch') {
          await fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]),
          );
        }
        expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(50);
        await fireEvent.pointerCancel(sliderControl, { pointerType, pointerId: 1 });
        if (pointerType === 'touch') {
          await fireEvent.touchCancel(document.body);
        }

        handleValueCommitted.mockClear();

        // Harness only: a prevented pointerdown still resets the flag but leaves the press to the
        // touch handler. Whether touch should respect the prevented pointerdown isn't pinned here.
        preventPointerDown = true;
        await fireEvent.pointerDown(sliderControl, {
          pointerType: 'touch',
          pointerId: 2,
          buttons: 1,
          clientX: 30,
        });
        const touches = createTouches([{ identifier: 2, clientX: 30, clientY: 0 }]);
        await fireEvent.touchStart(sliderControl, touches);
        expect(handleValueChange.mock.calls.at(-1)?.[0]).toBe(30);

        await fireEvent.pointerUp(sliderControl, {
          pointerType: 'touch',
          pointerId: 2,
          clientX: 30,
        });
        await fireEvent.touchEnd(document.body, touches);
        expect(handleValueCommitted.mock.calls.length).toBe(1);
        expect(handleValueCommitted.mock.calls[0][0]).toBe(30);
      },
    );

    it.each(['touch', 'pen'])(
      'does not change the value on a %s tap on the thumb',
      async (pointerType) => {
        const handleValueChange = vi.fn();

        await render(
          <Slider.Root defaultValue={100} step={3} onValueChange={handleValueChange}>
            <Slider.Control data-testid="control">
              <Slider.Thumb data-testid="thumb" />
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');
        const thumb = screen.getByTestId('thumb');

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );
        vi.spyOn(thumb, 'getBoundingClientRect').mockImplementation(
          () => new DOMRect(95, 0, 10, 10),
        );

        const touches = createTouches([{ identifier: 1, clientX: 100, clientY: 0 }]);

        await fireEvent.pointerDown(thumb, {
          pointerType,
          pointerId: 1,
          buttons: 1,
          clientX: 100,
        });
        await fireEvent.touchStart(thumb, touches);
        await fireEvent.pointerUp(thumb, { pointerType, pointerId: 1, clientX: 100 });
        await fireEvent.touchEnd(document.body, touches);

        expect(handleValueChange.mock.calls.length).toBe(0);
      },
    );

    // Requires layout: the range drag relies on real thumb measurements.
    it.skipIf(isJSDOM)('array value', async () => {
      const handleValueCommitted = vi.fn(
        (newValue: number[], eventDetails: Slider.Root.CommitEventDetails) => ({
          newValue,
          reason: eventDetails.reason,
        }),
      );

      await render(
        <Slider.Root onValueCommitted={handleValueCommitted} defaultValue={[10, 20]}>
          <Slider.Control data-testid="control">
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Control>
        </Slider.Root>,
      );

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const [thumb1, thumb2] = screen.getAllByRole('slider');

      await fireEvent.pointerDown(thumb2, {
        buttons: 1,
        clientX: 20,
      });

      await fireEvent.pointerMove(thumb2, {
        buttons: 1,
        clientX: 30,
      });

      expect(handleValueCommitted.mock.calls.length).toBe(0);

      await fireEvent.pointerUp(thumb2, {
        buttons: 1,
        clientX: 30,
      });

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.drag);

      thumb1.focus();
      await flushMicrotasks();

      await fireEvent.change(thumb1, { target: { value: 23 } });
      expect(handleValueCommitted.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
    });

    it('does not commit a canceled change', async () => {
      const handleValueChange = vi.fn((_value, details) => details.cancel());
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit when keyboard interaction leaves the value unchanged', async () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={100}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '100');
    });

    it.skipIf(isJSDOM)('does not commit when thumb press leaves the value unchanged', async () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      const thumb = screen.getByTestId('thumb');

      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
      vi.spyOn(thumb, 'getBoundingClientRect').mockImplementation(() => ({
        width: 0,
        height: 0,
        bottom: 0,
        left: 50,
        right: 50,
        top: 0,
        x: 50,
        y: 0,
        toJSON() {},
      }));

      await fireEvent.pointerDown(thumb, { buttons: 1, clientX: 50 });
      await fireEvent.pointerUp(document.body, { buttons: 1, clientX: 50 });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('keyboard interactions', () => {
    const keyboardCases: {
      direction: TextDirection;
      orientation: Orientation;
      decrementKeys: string[];
      incrementKeys: string[];
    }[] = [
      {
        direction: 'ltr',
        orientation: 'horizontal',
        decrementKeys: [ARROW_LEFT, ARROW_DOWN],
        incrementKeys: [ARROW_RIGHT, ARROW_UP],
      },
      {
        direction: 'ltr',
        orientation: 'vertical',
        decrementKeys: [ARROW_LEFT, ARROW_DOWN],
        incrementKeys: [ARROW_RIGHT, ARROW_UP],
      },
      {
        direction: 'rtl',
        orientation: 'horizontal',
        decrementKeys: [ARROW_RIGHT, ARROW_DOWN],
        incrementKeys: [ARROW_LEFT, ARROW_UP],
      },
      {
        direction: 'rtl',
        orientation: 'vertical',
        decrementKeys: [ARROW_RIGHT, ARROW_DOWN],
        incrementKeys: [ARROW_LEFT, ARROW_UP],
      },
    ];

    describe.each(keyboardCases)(
      '$direction, orientation: $orientation',
      ({ direction, orientation, decrementKeys, incrementKeys }) => {
        describe.each(decrementKeys.map((key) => ({ key })))('key: $key', ({ key }) => {
          it('decrements the value', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(19);
            expect(input).toHaveAttribute('aria-valuenow', '19');
          });

          it('decrements the value by largeStep when Shift is pressed', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={10}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`{Shift>}{${key}}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(10);
            expect(input).toHaveAttribute('aria-valuenow', '10');
          });

          it('stops at min when decrementing while Shift is pressed', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={10}
                    min={15}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`{Shift>}{${key}}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(15);
            expect(input).toHaveAttribute('aria-valuenow', '15');
          });
        });

        describe.each(incrementKeys.map((key) => ({ key })))('key: $key', ({ key }) => {
          it('increments the value', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(21);
            expect(input).toHaveAttribute('aria-valuenow', '21');
          });

          it('rounds fractional values to the configured step', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={0.2}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${key}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(0.3);
            expect(input).toHaveAttribute('aria-valuenow', '0.3');
          });

          it('increments the value by largeStep when Shift is pressed', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={10}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`{Shift>}{${key}}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(30);
            expect(input).toHaveAttribute('aria-valuenow', '30');
          });

          it('stops at max when incrementing while Shift is pressed', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={10}
                    max={21}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`{Shift>}{${key}}`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(21);
            expect(input).toHaveAttribute('aria-valuenow', '21');
          });
        });

        describe('key: End', () => {
          it('sets value to max in a single value slider', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    max={77}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(77);
            expect(input).toHaveAttribute('aria-valuenow', '77');
          });

          it('sets value to the maximum possible value in a range slider', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root defaultValue={[20, 50]} max={77} onValueChange={handleValueChange}>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb index={0} />
                        <Slider.Thumb index={1} />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const [input1, input2] = screen.getAllByRole('slider');

            await user.keyboard('[Tab]');
            expect(input1).toHaveFocus();

            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual([50, 50]);
            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);

            await user.keyboard('[Tab]');
            expect(input2).toHaveFocus();

            await user.keyboard(`[${END}]`);
            expect(handleValueChange.mock.calls.length).toBe(2);
            expect(handleValueChange.mock.calls[1][0]).toEqual([50, 77]);
          });
        });

        describe('key: Home', () => {
          it('sets value to min in a single value slider', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    min={17}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(17);
            expect(input).toHaveAttribute('aria-valuenow', '17');
          });

          it('sets value to the minimum possible value in a range slider', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root defaultValue={[20, 50]} min={7} onValueChange={handleValueChange}>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb index={0} />
                        <Slider.Thumb index={1} />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const [input1, input2] = screen.getAllByRole('slider');

            await user.keyboard('[Tab]');
            await user.keyboard('[Tab]');
            expect(input2).toHaveFocus();

            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual([20, 20]);
            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(1);

            await user.keyboard('{Shift>}{Tab}');
            expect(input1).toHaveFocus();

            await user.keyboard(`[${HOME}]`);
            expect(handleValueChange.mock.calls.length).toBe(2);
            expect(handleValueChange.mock.calls[1][0]).toEqual([7, 20]);
          });
        });

        describe('key: PageUp', () => {
          it('increments the value by largeStep', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={5}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(25);
            expect(input).toHaveAttribute('aria-valuenow', '25');
          });

          it('preserves largeStep increments when step uses a different grid', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    step={2}
                    largeStep={5}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(25);
            expect(input).toHaveAttribute('aria-valuenow', '25');
          });

          it('does not exceed max', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={5}
                    max={21}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard('[PageUp]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(21);
            expect(input).toHaveAttribute('aria-valuenow', '21');
          });
        });

        describe('key: PageDown', () => {
          it('decrements the value by largeStep', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={5}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard('[PageDown]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(15);
            expect(input).toHaveAttribute('aria-valuenow', '15');
          });

          it('does not go below min', async () => {
            const handleValueChange = vi.fn();
            const { user } = await render(
              <div dir={direction}>
                <DirectionProvider direction={direction}>
                  <Slider.Root
                    orientation={orientation}
                    defaultValue={20}
                    largeStep={5}
                    min={17}
                    onValueChange={handleValueChange}
                  >
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                        <Slider.Thumb data-testid="thumb" />
                      </Slider.Track>
                    </Slider.Control>
                  </Slider.Root>
                </DirectionProvider>
              </div>,
            );

            const input = screen.getByRole('slider');

            await user.keyboard('[Tab]');
            expect(input).toHaveFocus();

            await user.keyboard('[PageDown]');
            expect(handleValueChange.mock.calls.length).toBe(1);
            expect(handleValueChange.mock.calls[0][0]).toEqual(17);
            expect(input).toHaveAttribute('aria-valuenow', '17');
          });
        });
      },
    );

    it('keypresses should correct invalid values', async () => {
      const value = shallowRef(5.4698);
      const { user } = await render(() => (
        <Slider.Root
          value={value.value}
          onValueChange={(next) => {
            value.value = next;
          }}
          min={0}
          max={10}
          step={1}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));

      const input = screen.getByRole('slider');

      expect(input).toHaveAttribute('aria-valuenow', '5.4698');
      await user.keyboard('[Tab]');
      expect(input).toHaveFocus();
      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveAttribute('aria-valuenow', '6');
    });
  });

  describe('Form', () => {
    describe.skipIf(isJSDOM)('form submission', () => {
      it('should include the slider value', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget as HTMLFormElement);
          expect(formData.get('slider')).toBe('25');
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={25} format={USD_NUMBER_FORMAT}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('should include range slider value', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget as HTMLFormElement);
          expect(formData.getAll('slider')).toEqual(['25', '50']);
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={[25, 50]} format={USD_NUMBER_FORMAT}>
                <Slider.Control>
                  <Slider.Thumb />
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('submits clamped range slider values to onFormSubmit', async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={[19, 41]} min={20} max={40}>
                <Slider.Control>
                  <Slider.Thumb />
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledWith(
          { slider: [20, 40] },
          expect.objectContaining({ reason: 'none' }),
        );
      });

      it('submits a clamped single-thumb slider value to onFormSubmit', async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={5} min={20} max={40}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledWith(
          { slider: 20 },
          expect.objectContaining({ reason: 'none' }),
        );
      });

      it('submits to an external form when `form` is provided', async () => {
        let submitValue: FormDataEntryValue | null = null;

        await render(
          <>
            <form
              id="external-form"
              onSubmit={(event: Event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget as HTMLFormElement);
                submitValue = formData.get('slider');
              }}
            >
              <button type="submit">Submit</button>
            </form>
            <Slider.Root name="slider" form="external-form" defaultValue={25}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </>,
        );

        await fireEvent.click(screen.getByRole('button'));

        expect(submitValue).toBe('25');
      });
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-disabled', '');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-slider">
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute('name', 'field-slider');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(root).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      await fireEvent.change(input, { target: { value: 'value' } });

      expect(root).toHaveAttribute('data-dirty', '');
    });

    it('[data-dirty] with a range value', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root" defaultValue={[20, 40]}>
            <Slider.Control>
              <Slider.Thumb index={0} />
              <Slider.Thumb index={1} />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const [, input2] = screen.getAllByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      await fireEvent.change(input2, { target: { value: '50' } });

      expect(root).toHaveAttribute('data-dirty', '');

      await fireEvent.change(input2, { target: { value: '40' } });

      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);

      expect(root).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);

      expect(root).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function Thumbs(props: {
        firstMounted?: boolean;
        firstDisabled?: boolean;
        rangeValue?: boolean;
      }) {
        const { firstMounted = true, firstDisabled = false, rangeValue = false } = props;
        return (
          <Field.Root data-testid="root">
            <Slider.Root defaultValue={rangeValue ? [20, 40] : 20}>
              <Slider.Control>
                {firstMounted && <Slider.Thumb disabled={firstDisabled} />}
                {rangeValue && <Slider.Thumb />}
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        );
      }

      it('is removed when the focused thumb becomes disabled', async () => {
        const { setProps } = await render(<Thumbs />);

        screen.getByRole('slider').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused thumb unmounts', async () => {
        const { setProps } = await render(<Thumbs />);

        screen.getByRole('slider').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      // A thumb's `blur` deliberately does nothing when focus moves to a sibling thumb, so a thumb
      // that once held focus must not assume it still owns the field's focused state.
      it('is kept when focus moved to a sibling before the first thumb is disabled', async () => {
        const { setProps } = await render(<Thumbs rangeValue />);

        const [first, second] = screen.getAllByRole('slider');

        first.focus();
        await flushMicrotasks();
        second.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });

      it('is kept when a sibling thumb is disabled or unmounted', async () => {
        const { setProps } = await render(<Thumbs rangeValue />);

        screen.getAllByRole('slider')[1].focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });
    });

    describe('prop: validate', () => {
      it('validationMode=onSubmit', async () => {
        await render(
          <Form>
            <Field.Root validate={(val) => ((val as number) > 90 ? 'error' : null)}>
              <Slider.Root defaultValue={99} data-testid="root">
                <Slider.Control>
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const root = screen.getByTestId('root');
        const thumb = screen.getByTestId('thumb');
        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.change(input, { target: { value: '98' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);
        expect(root).toHaveAttribute('data-invalid');
        expect(thumb).toHaveAttribute('data-invalid');

        await fireEvent.change(input, { target: { value: '10' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(root).not.toHaveAttribute('data-invalid');
        expect(input).not.toHaveAttribute('data-invalid');
        expect(root).toHaveAttribute('data-valid');
        expect(thumb).toHaveAttribute('data-valid');

        await fireEvent.change(input, { target: { value: '94' } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);

        await fireEvent.change(input, { target: { value: '12' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });

      it('moves focus to the range input on invalid submit', async () => {
        await render(
          <Form>
            <Field.Root validate={() => 'error'}>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveFocus();

        await fireEvent.click(screen.getByText('submit'));

        // Slider registers the range input as the field control, so invalid
        // submits focus the native input instead of the non-focusable wrapper.
        expect(input).toHaveFocus();
      });

      it('validationMode=onBlur', async () => {
        await render(
          <Field.Root
            validationMode="onBlur"
            validate={(value) => ((value as number) > 1 ? 'error' : null)}
          >
            <Slider.Root>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.change(input, { target: { value: '2' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        await fireEvent.focusOut(input);
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validationMode=onBlur preserves single-element array values', async () => {
        const validate = vi.fn<(value: unknown) => null>(() => null);

        await render(
          <Field.Root validationMode="onBlur" validate={validate}>
            <Slider.Root defaultValue={[25]}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await fireEvent.focusOut(screen.getByRole('slider'));
        await flushMicrotasks();

        expect(validate.mock.calls[0][0]).toEqual([25]);
      });

      it('validationMode=onChange', async () => {
        await render(
          <Field.Root
            validationMode="onChange"
            validate={(value) => (Number(value) === 1 ? 'error' : null)}
          >
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.change(input, { target: { value: '1' } });
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validates once when changed by the user', async () => {
        const validate = vi.fn();

        const { user } = await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getByRole('slider')).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toBe(1);
      });

      it('validates once with an array value for range sliders when changed by the user', async () => {
        const validate = vi.fn();

        const { user } = await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={[0, 5]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getAllByRole('slider')[0]).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toEqual([1, 5]);
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => (Number(value) === 5 ? 'error' : null));
        const value = shallowRef(0);

        await render(() => (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="volume">
              <Slider.Root
                value={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                value.value = 5;
              }}
            >
              Set externally
            </button>
          </>
        ));

        const slider = screen.getByRole('slider');
        const toggle = screen.getByText('Set externally');

        expect(slider).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        await fireEvent.click(toggle);
        await flushMicrotasks();

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(slider).toHaveAttribute('aria-invalid', 'true');
      });

      it('receives an array value for range sliders', async () => {
        const validateSpy = vi.fn();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        await render(
          <Form onSubmit={onSubmit}>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={[5, 12]}>
                <Slider.Control>
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        await fireEvent.click(screen.getByText('submit'));
        expect(validateSpy.mock.calls.length).toBe(1);
        expect(validateSpy.mock.calls[0][0]).toEqual([5, 12]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not call validate on change when validationMode is omitted', async () => {
        const validateSpy = vi.fn();
        await render(
          <Form>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={50}>
                <Slider.Control data-testid="control">
                  <Slider.Track>
                    <Slider.Thumb aria-label="Value" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        expect(validateSpy.mock.calls.length).toBe(0);

        const sliderControl = screen.getByTestId('control');
        await fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 10 });
        await fireEvent.pointerUp(sliderControl, { buttons: 1, clientX: 30 });

        expect(validateSpy.mock.calls.length).toBe(0);
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
          <Field.Label data-testid="label" />
        </Field.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label', async () => {
      await render(
        <Slider.Root>
          <Slider.Label data-testid="label" />
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label focuses slider on click', async () => {
      const { user } = await render(
        <Slider.Root>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByRole('slider')).toHaveFocus();
    });

    it('Slider.Label does not focus a thumb on click for range sliders', async () => {
      const { user } = await render(
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label data-testid="label">Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb aria-label="Minimum price" />
              <Slider.Thumb aria-label="Maximum price" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      await user.click(screen.getByTestId('label'));

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).not.toHaveFocus();
      expect(maximumSlider).not.toHaveFocus();
    });

    it('does not set aria-labelledby when getAriaLabel is provided', async () => {
      await render(
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label>Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb getAriaLabel={() => 'Minimum price'} />
              <Slider.Thumb getAriaLabel={() => 'Maximum price'} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).toHaveAttribute('aria-label', 'Minimum price');
      expect(maximumSlider).toHaveAttribute('aria-label', 'Maximum price');
      expect(minimumSlider).not.toHaveAttribute('aria-labelledby');
      expect(maximumSlider).not.toHaveAttribute('aria-labelledby');
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      await render(
        <Slider.Root>
          <Slider.Control>
            <Slider.Thumb aria-label="Volume" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByRole('slider')).not.toHaveAttribute('aria-labelledby');
    });

    it('updates Slider.Label linkage when root id changes', async () => {
      const { setProps } = await render(
        <Slider.Root id="first" defaultValue={30} data-testid="root">
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      await setProps({ id: 'second' });

      const slider = screen.getByRole('slider');
      await waitFor(() => {
        expect(slider).toHaveAttribute('aria-labelledby', 'second-label');
      });

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('id', 'second');
      expect(screen.getByTestId('label')).toHaveAttribute('id', 'second-label');
      expect(root).toHaveAttribute('aria-labelledby', 'second-label');
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="slider" aria-describedby="external-description">
            <Slider.Control />
          </Slider.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('slider')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('in a native form', () => {
    function getFormData() {
      return [...new FormData(screen.getByTestId<HTMLFormElement>('form')).entries()];
    }

    function getInputs() {
      return screen.getAllByRole<HTMLInputElement>('slider');
    }

    it('submits no entry for a disabled slider', async () => {
      await render(
        <form data-testid="form">
          <Slider.Root name="volume" defaultValue={30}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
          <Slider.Root name="balance" defaultValue={5} disabled>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </form>,
      );

      expect(getFormData()).toEqual([['volume', '30']]);
    });

    it('writes its state to the inputs after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      await render(
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
      const [first, second] = getInputs();
      first.value = '55';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect([first.value, second.value]).toEqual(['20', '80']);
    });

    describe('BUG-6206: a native reset', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each([
        { name: 'a single value', defaultValue: 30, data: [['price', '30']] },
        {
          name: 'a range',
          defaultValue: [20, 80],
          data: [
            ['price', '20'],
            ['price', '80'],
          ],
        },
      ])(
        'puts an uncontrolled slider back to its default, $name',
        async ({ defaultValue, data }) => {
          const handleValueChange = vi.fn();
          const handleValueCommitted = vi.fn();
          await render(
            <form data-testid="form">
              <Slider.Root
                name="price"
                defaultValue={defaultValue}
                onValueChange={handleValueChange}
                onValueCommitted={handleValueCommitted}
              >
                <Slider.Control>
                  {Array.isArray(defaultValue) ? (
                    <>
                      <Slider.Thumb />
                      <Slider.Thumb />
                    </>
                  ) : (
                    <Slider.Thumb />
                  )}
                </Slider.Control>
              </Slider.Root>
            </form>,
          );
          await fireEvent.change(getInputs()[0], { target: { value: '55' } });
          expect(getFormData()[0]).toEqual(['price', '55']);
          handleValueChange.mockClear();
          handleValueCommitted.mockClear();

          screen.getByTestId<HTMLFormElement>('form').reset();
          await settleReset();

          expect(getFormData()).toEqual(data);
          expect(getInputs().map((input) => input.getAttribute('aria-valuenow'))).toEqual(
            data.map(([, value]) => value),
          );
          expect(handleValueChange).toHaveBeenCalledTimes(1);
          expect(handleValueChange.mock.lastCall?.[1].reason).toBe(REASONS.none);
          expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');
          expect(handleValueCommitted).toHaveBeenCalledTimes(1);
          expect(handleValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.none);

          // A reset with nothing to change.
          screen.getByTestId<HTMLFormElement>('form').reset();
          await settleReset();

          expect(handleValueChange).toHaveBeenCalledTimes(1);
          expect(handleValueCommitted).toHaveBeenCalledTimes(1);
        },
      );

      it('keeps the value of a controlled slider', async () => {
        const handleValueChange = vi.fn();
        const value = shallowRef(40);
        await render(() => (
          <form data-testid="form">
            <Slider.Root
              name="price"
              value={value.value}
              onValueChange={handleValueChange}
              {...{ 'onUpdate:value': (next: number) => (value.value = next) }}
            >
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </form>
        ));
        await fireEvent.change(getInputs()[0], { target: { value: '55' } });
        handleValueChange.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(handleValueChange).not.toHaveBeenCalled();
        expect(getFormData()).toEqual([['price', '55']]);
      });

      it.each([
        {
          name: 'a slider whose form cancels the reset',
          renderForm: () => (
            <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
              <Slider.Root name="price" defaultValue={30}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </form>
          ),
        },
        {
          name: 'a slider of another form',
          renderForm: () => (
            <div>
              <form data-testid="form" />
              <form id="other" />
              <Slider.Root name="price" defaultValue={30} form="other">
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </div>
          ),
        },
      ])('keeps the value of $name', async ({ renderForm }) => {
        await render(renderForm());
        await fireEvent.change(getInputs()[0], { target: { value: '55' } });

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getInputs()[0]).toHaveAttribute('aria-valuenow', '55');
      });

      it('keeps the value of a slider whose listener cancels the change of the reset, and commits nothing', async () => {
        const handleValueCommitted = vi.fn();
        await render(
          <form data-testid="form">
            <Slider.Root
              name="price"
              defaultValue={30}
              onValueChange={(_value: number, details: Slider.Root.ChangeEventDetails) => {
                if (details.event.type === 'reset') {
                  details.cancel();
                }
              }}
              onValueCommitted={handleValueCommitted}
            >
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </form>,
        );
        await fireEvent.change(getInputs()[0], { target: { value: '55' } });
        handleValueCommitted.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(handleValueCommitted).not.toHaveBeenCalled();
        expect(getInputs()[0]).toHaveAttribute('aria-valuenow', '55');
        expect(getFormData()).toEqual([['price', '55']]);
      });
    });

    describe('VUE-21: a native reset removes the error of the field', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      function expectNeutralField() {
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(getInputs()[0]).not.toHaveAttribute('aria-invalid');
        expect(getInputs()[0].validationMessage).toBe('');
      }

      it('VUE-21: removes the error when the reset changes the value, and validates no default value', async () => {
        const validate = vi.fn((value: unknown) => (value === 30 ? null : 'Too high'));
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="price"
              validate={validate}
              validationMode="onChange"
            >
              <Slider.Root defaultValue={30}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await fireEvent.change(getInputs()[0], { target: { value: '55' } });
        expect(screen.getByTestId('error')).toHaveTextContent('Too high');
        validate.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getInputs()[0]).toHaveAttribute('aria-valuenow', '30');
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        // The next change validates again.
        await fireEvent.change(getInputs()[0], { target: { value: '60' } });

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Too high');
      });

      it.each([
        {
          name: 'the validation of the field',
          renderForm: () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="price"
                validate={(value: unknown) => (value === 30 ? 'Pick another value' : null)}
              >
                <Slider.Root defaultValue={30}>
                  <Slider.Control>
                    <Slider.Thumb />
                  </Slider.Control>
                </Slider.Root>
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: () => fireEvent.submit(screen.getByTestId('form')),
        },
        {
          name: 'the form',
          renderForm: () => (
            <Form data-testid="form" errors={{ price: 'Server error' }}>
              <Field.Root data-testid="root" name="price">
                <Slider.Root defaultValue={30}>
                  <Slider.Control>
                    <Slider.Thumb />
                  </Slider.Control>
                </Slider.Root>
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
          makeInvalid: undefined,
        },
      ])(
        'VUE-21: removes the error of $name when the reset leaves the value as it is',
        async ({ renderForm, makeInvalid }) => {
          await render(renderForm());
          await makeInvalid?.();
          expect(screen.getByTestId('error')).toBeInTheDocument();

          screen.getByTestId<HTMLFormElement>('form').reset();
          await settleReset();

          expect(getInputs()[0]).toHaveAttribute('aria-valuenow', '30');
          expectNeutralField();
        },
      );
    });
  });
});
