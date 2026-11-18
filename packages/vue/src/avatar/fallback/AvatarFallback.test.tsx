import { vi, expect, describe, beforeEach, afterEach, it, onTestFinished } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Avatar } from '@vase-ui/vue/avatar';
import {
  createHeldBranch,
  describeConformance,
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
} from '#test-utils';

function stubImage(complete: boolean, naturalWidth: number) {
  vi.stubGlobal(
    'Image',
    class {
      complete = complete;
      naturalWidth = naturalWidth;
    },
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

describe('<Avatar.Fallback />', () => {
  const { render } = createRenderer();

  describeConformance(<Avatar.Fallback />, () => ({
    render: (node) => {
      return render(<Avatar.Root>{node}</Avatar.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('should not render the children if the image loaded', async () => {
    stubImage(true, 1);

    await render(
      <Avatar.Root>
        <Avatar.Image src="avatar.png" />
        <Avatar.Fallback data-testid="fallback" />
      </Avatar.Root>,
    );

    expect(screen.queryByTestId('fallback')).toBe(null);
  });

  it('should render the fallback if the image fails to load', async () => {
    stubImage(true, 0);
    const change = vi.fn();

    await render(
      <Avatar.Root>
        <Avatar.Image src="avatar.png" onLoadingStatusChange={change} />
        <Avatar.Fallback>AC</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(change).toHaveBeenCalledWith('error');
    expect(screen.getByText('AC')).toBeVisible();
  });

  it('shows the fallback when a loaded image is unmounted', async () => {
    stubImage(true, 1);

    const Test = defineComponent(() => {
      const showImage = shallowRef(true);

      return () => (
        <div>
          <button
            type="button"
            onClick={() => {
              showImage.value = false;
            }}
          >
            Hide image
          </button>
          <Avatar.Root>
            {showImage.value && <Avatar.Image data-testid="image" src="avatar.png" />}
            <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
          </Avatar.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.queryByTestId('fallback')).toBe(null);
    expect(screen.getByTestId('image')).not.toBe(null);

    await user.click(screen.getByText('Hide image'));

    await waitFor(() => {
      expect(screen.getByTestId('fallback')).not.toBe(null);
    });
    expect(screen.queryByTestId('image')).toBe(null);
  });

  describe('prop: delay', () => {
    const { render: renderFakeTimers } = createRenderer();

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the fallback when the delay has elapsed', async () => {
      await renderFakeTimers(
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={100}>AC</Avatar.Fallback>
        </Avatar.Root>,
      );

      expect(screen.queryByText('AC')).toBe(null);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('restarts the delay when it changes while KeepAlive holds the fallback', async () => {
      const delay = shallowRef(100);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Avatar.Root>
          <Avatar.Fallback delay={delay.value}>JD</Avatar.Fallback>
        </Avatar.Root>
      ));
      await renderFakeTimers(<HeldBranch />);
      await mountWhileHeld();
      vi.advanceTimersByTime(50);
      delay.value = 200;
      await flushMicrotasks();
      vi.advanceTimersByTime(50);
      await show();
      expect(screen.queryByText('JD')).toBeNull();

      vi.advanceTimersByTime(150);
      await flushMicrotasks();
      expect(screen.getByText('JD')).toBeVisible();
    });

    it('shows the fallback immediately when delay is 0', async () => {
      await renderFakeTimers(
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={0}>AC</Avatar.Fallback>
        </Avatar.Root>,
      );

      // No timers are advanced: `delay={0}` must render synchronously on mount.
      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('shows the fallback when delay changes to 0', async () => {
      function Test(props: { delay?: number }) {
        return (
          <Avatar.Root>
            <Avatar.Image />
            <Avatar.Fallback delay={props.delay}>AC</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { setProps } = await renderFakeTimers(<Test delay={100} />);

      expect(screen.queryByText('AC')).toBe(null);

      await setProps({ delay: 0 });

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible when delay changes from undefined to a number', async () => {
      function Test(props: { delay?: number }) {
        return (
          <Avatar.Root>
            <Avatar.Image />
            <Avatar.Fallback delay={props.delay}>AC</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { setProps } = await renderFakeTimers(<Test />);

      expect(screen.queryByText('AC')).not.toBe(null);

      await setProps({ delay: 100 });

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible across a number -> undefined -> number delay change', async () => {
      function Test(props: { delay?: number }) {
        return (
          <Avatar.Root>
            <Avatar.Image />
            <Avatar.Fallback delay={props.delay}>AC</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { setProps } = await renderFakeTimers(<Test delay={100} />);

      // Fallback is hidden until the delay elapses.
      expect(screen.queryByText('AC')).toBe(null);

      // Removing the delay before it elapses shows the fallback immediately.
      await setProps({ delay: undefined });
      expect(screen.queryByText('AC')).not.toBe(null);

      // Restoring the delay must not re-hide the already-visible fallback.
      await setProps({ delay: 100 });
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('keeps fallback mounted and image unmounted while the image is loading', async () => {
    stubImage(false, 0);
    const change = vi.fn();

    const Test = defineComponent(() => {
      const showImage = shallowRef(false);

      return () => (
        <div>
          <button
            type="button"
            onClick={() => {
              showImage.value = true;
            }}
          >
            Show image
          </button>
          <Avatar.Root>
            <Avatar.Image
              data-testid="image"
              src={showImage.value ? 'avatar.png' : undefined}
              onLoadingStatusChange={change}
            />
            <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
          </Avatar.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);

    await user.click(screen.getByText('Show image'));

    expect(change).toHaveBeenLastCalledWith('loading');
    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);
  });

  describe.skipIf(isJSDOM)('regression', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('keeps only one of image or fallback mounted when switching to image', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      stubImage(true, 1);

      const style = `
        @keyframes test-exit {
          to {
            opacity: 0;
          }
        }

        .animation-test-fallback[data-ending-style] {
          animation: test-exit 2s;
        }
      `;

      const Test = defineComponent(() => {
        const showImage = shallowRef(false);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showImage.value = true;
              }}
            >
              Show image
            </button>
            <Avatar.Root>
              <Avatar.Image data-testid="image" src={showImage.value ? 'avatar.png' : undefined} />
              <Avatar.Fallback class="animation-test-fallback" data-testid="fallback">
                AC
              </Avatar.Fallback>
            </Avatar.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);

      expect(screen.queryByTestId('image')).toBe(null);
      expect(screen.getByTestId('fallback')).not.toBe(null);

      await user.click(screen.getByText('Show image'));

      // The fallback unmounts once the image reports `loaded` to the root, after the image mounts.
      expect(screen.queryByTestId('fallback')).toBe(null);
      expect(screen.queryByTestId('image')).not.toBe(null);
    });
  });
});
