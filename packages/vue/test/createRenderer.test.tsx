import { expect, describe, it, vi, afterEach, onTestFinished } from 'vitest';
import { defineComponent, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { ComponentPublicInstance, VNode } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitForLaterMillisecond } from '#test-utils';

describe('createRenderer', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.useRealTimers();
  });

  const Part = defineComponent({
    props: { label: { type: String, default: 'first' } },
    setup: (props) => () => <button type="button">{props.label}</button>,
  });

  it('keeps a ref on a vnode that a function makes', async () => {
    let instance: ComponentPublicInstance | null = null;

    await render(() => (
      <Part
        ref={(value) => {
          instance = value as ComponentPublicInstance | null;
        }}
      />
    ));

    expect(instance).not.toBeNull();
    expect(instance!.$el).toBe(screen.getByRole('button'));
  });

  it('patches the component and does not mount it again on rerender', async () => {
    const mounted = vi.fn();
    const Counted = defineComponent({
      props: { label: { type: String, default: 'first' } },
      setup(props) {
        onMounted(mounted);
        return () => <button type="button">{props.label}</button>;
      },
    });

    const { rerender } = await render(<Counted label="first" />);
    const button = screen.getByRole('button');

    await rerender(<Counted label="second" />);

    expect(mounted).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBe(button);
    expect(button).toHaveTextContent('second');
  });

  it('replaces a prop with setProps and does not keep the props of an earlier call', async () => {
    const { setProps } = await render(<Part data-first="a" />);

    expect(screen.getByRole('button')).toHaveAttribute('data-first', 'a');

    await setProps({ label: 'second', 'data-second': 'b' });
    expect(screen.getByRole('button')).toHaveTextContent('second');
    expect(screen.getByRole('button')).toHaveAttribute('data-second', 'b');

    await setProps({ label: 'third' });
    expect(screen.getByRole('button')).toHaveTextContent('third');
    expect(screen.getByRole('button')).not.toHaveAttribute('data-second');
  });

  it('gives a user that sends input to the document', async () => {
    const handleClick = vi.fn();
    const { user } = await render(
      <button type="button" onClick={handleClick}>
        Press
      </button>,
    );

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the vnode of a render function in setProps', async () => {
    const { setProps } = await render(() => <Part data-first="a" />);

    await setProps({ label: 'second' });

    expect(screen.getByRole('button')).toHaveTextContent('second');
    expect(screen.getByRole('button')).toHaveAttribute('data-first', 'a');
  });

  describe('a click right after the mount', () => {
    async function mountAndClick() {
      const capture = vi.fn();
      const bubble = vi.fn();
      const { container, unmount } = await render(
        <div data-testid="target" {...{ onClickCapture: capture }} onClick={bubble} />,
      );

      (container.firstElementChild as HTMLElement).click();
      unmount();

      return capture.mock.calls.length === 1 && bubble.mock.calls.length === 1;
    }

    it('runs the capture listener and the bubble listener of one element', async () => {
      let failures = 0;
      for (let index = 0; index < 100; index += 1) {
        if (!(await mountAndClick())) {
          failures += 1;
        }
      }

      expect(failures).toBe(0);
    });

    it('runs both listeners under fake timers, and render resolves', async () => {
      vi.useFakeTimers();

      expect(await mountAndClick()).toBe(true);
    });

    it('runs both listeners under fake timers that leave Date real', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      let failures = 0;
      for (let index = 0; index < 100; index += 1) {
        if (!(await mountAndClick())) {
          failures += 1;
        }
      }

      expect(failures).toBe(0);
    });

    it('runs both listeners with a mocked date and real timers, and render resolves', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      expect(await mountAndClick()).toBe(true);
    });

    it('runs both listeners with a mocked date and a mount longer than one frame, and render resolves', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const capture = vi.fn();
      const bubble = vi.fn();
      // The mocked date does not move while the mount holds the page for 20 ms of real time.
      const SlowMount = defineComponent(() => {
        const end = performance.now() + 20;
        while (performance.now() < end) {
          // The loop holds the page.
        }
        return () => null;
      });
      const { getByTestId } = await render(
        <div>
          <div data-testid="target" {...{ onClickCapture: capture }} onClick={bubble} />
          <SlowMount />
        </div>,
      );

      getByTestId('target').click();

      expect({ capture: capture.mock.calls.length, bubble: bubble.mock.calls.length }).toEqual({
        capture: 1,
        bubble: 1,
      });
    });

    describe('when the wall clock steps by 3 ms', () => {
      let offset = 0;
      let stepAfter = Number.POSITIVE_INFINITY;

      function stepBack() {
        offset -= 3;
      }

      // Each read of `Date.now()` or `performance.now()` moves both clocks by 0.01 ms. The cases
      // thus do not depend on the timer resolution of the browser, which is 1 ms in Firefox and
      // WebKit. A click right after a mount comes in the millisecond of the mount, unless the helper
      // waits. `Date.now()` adds `offset`. At its first read that is later than `stepAfter`, it steps
      // back.
      function mockClocks() {
        let microseconds = Date.now() * 1000;
        offset = 0;
        stepAfter = Number.POSITIVE_INFINITY;
        const read = () => {
          microseconds += 10;
          return microseconds / 1000;
        };
        const performanceNow = vi.spyOn(performance, 'now').mockImplementation(read);
        const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => {
          const now = Math.floor(read()) + offset;
          if (now > stepAfter) {
            stepAfter = Number.POSITIVE_INFINITY;
            stepBack();
            return now - 3;
          }
          return now;
        });
        onTestFinished(() => {
          dateNow.mockRestore();
          performanceNow.mockRestore();
        });
      }

      // Vue calls the `onMounted` hook of the step after it attaches the listeners of the target.
      const StepBackOnMount = defineComponent(() => {
        onMounted(stepBack);
        return () => null;
      });

      // The step comes when the clock first gives a later millisecond than the mount.
      const StepBackAfterMount = defineComponent(() => {
        onMounted(() => {
          stepAfter = Date.now();
        });
        return () => null;
      });

      // Vue runs the setup of the step before it attaches the listeners of the target.
      const StepForwardOnSetup = defineComponent(() => {
        offset += 3;
        return () => null;
      });

      function createTarget(step: VNode) {
        const capture = vi.fn();
        const bubble = vi.fn();
        return {
          vnode: (
            <>
              {step}
              <div data-testid="target" {...{ onClickCapture: capture }} onClick={bubble} />
            </>
          ),
          calls: () => ({ capture: capture.mock.calls.length, bubble: bubble.mock.calls.length }),
        };
      }

      it('runs both listeners for a step back during the mount', async () => {
        mockClocks();
        const target = createTarget(<StepBackOnMount />);
        const { getByTestId } = await render(target.vnode);

        getByTestId('target').click();

        expect(target.calls()).toEqual({ capture: 1, bubble: 1 });
      });

      it('runs both listeners for a step back during the wait', async () => {
        mockClocks();
        const target = createTarget(<StepBackAfterMount />);
        const { getByTestId } = await render(target.vnode);

        getByTestId('target').click();

        expect(target.calls()).toEqual({ capture: 1, bubble: 1 });
      });

      it('runs both listeners for a step back during the action of waitForLaterMillisecond', async () => {
        mockClocks();
        const target = createTarget(<StepBackOnMount />);
        const shown = shallowRef(false);
        const { getByTestId } = await render(() => <div>{shown.value ? target.vnode : null}</div>);

        await waitForLaterMillisecond(() => {
          shown.value = true;
          return nextTick();
        });
        getByTestId('target').click();

        expect(target.calls()).toEqual({ capture: 1, bubble: 1 });
      });

      it('runs both listeners for a step forward during the mount', async () => {
        mockClocks();
        const target = createTarget(<StepForwardOnSetup />);
        const { getByTestId } = await render(target.vnode);

        getByTestId('target').click();

        expect(target.calls()).toEqual({ capture: 1, bubble: 1 });
      });
    });
  });

  describe('under fake timers', () => {
    it('runs a frame callback of the mount at the next frame', async () => {
      vi.useFakeTimers();
      const frame = vi.fn();
      const Framed = defineComponent(() => {
        onMounted(() => {
          requestAnimationFrame(frame);
        });
        return () => <div />;
      });

      await render(<Framed />);
      expect(frame).not.toHaveBeenCalled();

      vi.advanceTimersToNextFrame();
      expect(frame).toHaveBeenCalledTimes(1);
    });

    it('runs no timer of the mount, and each timer keeps its delay', async () => {
      vi.useFakeTimers();
      const immediate = vi.fn();
      const delayed = vi.fn();
      const Timed = defineComponent(() => {
        onMounted(() => {
          setTimeout(immediate, 0);
          setTimeout(delayed, 100);
        });
        return () => <div />;
      });

      await render(<Timed />);
      expect(immediate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(99);
      expect(immediate).toHaveBeenCalledTimes(1);
      expect(delayed).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(delayed).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the last state of a component that writes state after two ticks with flushMicrotasks', async () => {
    const Late = defineComponent(() => {
      const text = ref('start');
      async function change() {
        await nextTick();
        await nextTick();
        text.value = 'end';
      }
      return () => (
        <button type="button" onClick={() => void change()}>
          {text.value}
        </button>
      );
    });

    await render(<Late />);
    const button = screen.getByRole('button');

    button.click();
    await nextTick();
    expect(button).toHaveTextContent('start');

    await flushMicrotasks();
    expect(button).toHaveTextContent('end');
  });

  it('unmounts the app and removes the container after the test', async ({ onTestFinished }) => {
    let unmountCount = 0;
    const Counted = defineComponent(() => {
      onUnmounted(() => {
        unmountCount += 1;
      });
      return () => <button type="button">Press</button>;
    });
    const { container } = await render(<Counted />);

    expect(container.isConnected).toBe(true);
    expect(unmountCount).toBe(0);

    // A hook of `onTestFinished` runs after the hooks of `afterEach`.
    onTestFinished(() => {
      expect(unmountCount).toBe(1);
      expect(container.isConnected).toBe(false);
    });
  });
});
