import type { Mock } from 'vitest';
import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest';
import { computed, defineComponent, onMounted, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { Avatar } from '@vase-ui/vue/avatar';
import {
  describeConformance,
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
} from '#test-utils';
import { useImageLoadingStatus } from '../image/useImageLoadingStatus';
import type { ImageLoadingStatus } from '../root/AvatarRoot.vue';

vi.mock('../image/useImageLoadingStatus');

// The mock keeps the contract of the composable. The status is `'idle'` until the mount, and the
// part reports only a change of the status.
function mockLoadingStatus(getStatus: (src: string | undefined) => ImageLoadingStatus) {
  (useImageLoadingStatus as Mock).mockImplementation(
    (src: MaybeRefOrGetter<string | undefined>) => {
      const isMounted = shallowRef(false);
      onMounted(() => {
        isMounted.value = true;
      });
      return [computed(() => (isMounted.value ? getStatus(toValue(src)) : 'idle')), () => {}];
    },
  );
}

describe('<Avatar.Fallback />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    // The global `vi.resetAllMocks()` teardown clears the implementation, and the component
    // destructures the hook's return value, so every test needs a stub in place.
    mockLoadingStatus(() => 'idle');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describeConformance(<Avatar.Fallback />, () => ({
    render: (node) => {
      return render(<Avatar.Root>{node}</Avatar.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('should not render the children if the image loaded', async () => {
    mockLoadingStatus(() => 'loaded');

    await render(
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback data-testid="fallback" />
      </Avatar.Root>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
  });

  it('should render the fallback if the image fails to load', async () => {
    mockLoadingStatus(() => 'error');

    await render(
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback>AC</Avatar.Fallback>
      </Avatar.Root>,
    );

    await waitFor(() => {
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('shows the fallback when a loaded image is unmounted', async () => {
    mockLoadingStatus(() => 'loaded');

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

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
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

    it('shows the fallback immediately when delay is 0', async () => {
      mockLoadingStatus(() => 'error');

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
      mockLoadingStatus(() => 'error');

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
      mockLoadingStatus(() => 'error');

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
      mockLoadingStatus(() => 'error');

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
    mockLoadingStatus((src) => (src ? 'loading' : 'error'));

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
            <Avatar.Image data-testid="image" src={showImage.value ? 'avatar.png' : undefined} />
            <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
          </Avatar.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);

    await user.click(screen.getByText('Show image'));

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);
  });

  describe.skipIf(isJSDOM)('regression', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('keeps only one of image or fallback mounted when switching to image', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      mockLoadingStatus((src) => (src ? 'loaded' : 'error'));

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
      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).toBe(null);
      });
      expect(screen.queryByTestId('image')).not.toBe(null);
    });
  });
});
