import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, shallowRef, unref, watch } from 'vue';
import type { Ref } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  randomStringValue,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import type { TransitionStatus } from './useTransitionStatus';
import { useUnmountAfterClose } from './useUnmountAfterClose';

function createAnimation() {
  let resolveFinished!: () => void;

  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  return {
    animation: {
      finished,
      effect: { getTiming: () => ({ duration: 1, iterations: 1 }) },
      pending: false,
      playState: 'running',
    } as unknown as Animation,
    finish: resolveFinished,
  };
}

function createExitStyle(popupClass: string) {
  const animationName = randomStringValue();
  return `
    @keyframes ${animationName} { to { opacity: 0; } }
    .${popupClass}[data-ending-style] { animation: ${animationName} 10s; }
  `;
}

interface HostProps {
  /**
   * A ref changes in the write, as the open state of an uncontrolled root does. A boolean changes
   * in the flush, as the `open` prop of a controlled root does.
   */
  open: boolean | Ref<boolean>;
  showElement?: boolean | undefined;
  animateInitialOpen?: boolean | undefined;
  popupClass?: string | undefined;
}

function createHost() {
  const preventUnmountOnClose = shallowRef(false);
  const setPreventUnmountOnClose = vi.fn((value: boolean) => {
    preventUnmountOnClose.value = value;
  });
  const onUnmount = vi.fn();
  const transitionStatuses: TransitionStatus[] = [];
  let result!: ReturnType<typeof useUnmountAfterClose>;

  const Host = defineComponent(
    (props: HostProps) => {
      const element = shallowRef<HTMLDivElement | null>(null);

      result = useUnmountAfterClose({
        open: () => unref(props.open),
        ref: element,
        preventUnmountOnClose,
        setPreventUnmountOnClose,
        onUnmount,
        animateInitialOpen: props.animateInitialOpen,
      });
      watch(
        result.transitionStatus,
        (status) => {
          transitionStatuses.push(status);
        },
        { flush: 'sync' },
      );

      return () =>
        result.mounted.value && props.showElement !== false ? (
          <div
            ref={element}
            class={props.popupClass}
            data-testid="popup"
            data-starting-style={result.transitionStatus.value === 'starting' ? '' : undefined}
            data-ending-style={result.transitionStatus.value === 'ending' ? '' : undefined}
          />
        ) : null;
    },
    { props: ['open', 'showElement', 'animateInitialOpen', 'popupClass'] },
  );

  return {
    Host,
    onUnmount,
    setPreventUnmountOnClose,
    preventUnmountOnClose,
    transitionStatuses,
    get result() {
      return result;
    },
  };
}

describe('useUnmountAfterClose', () => {
  const { render } = createRenderer();

  describe('with animations disabled', () => {
    it('unmounts the popup and calls onUnmount one time after a close', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);

      await setProps({ open: false });

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('sets mounted to false before it calls onUnmount', async () => {
      const host = createHost();
      let mountedInCallback: boolean | undefined;
      host.onUnmount.mockImplementation(() => {
        mountedInCallback = host.result.mounted.value;
      });
      const { setProps } = await render(<host.Host open />);

      await setProps({ open: false });

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(mountedInCallback).toBe(false);
    });

    it('keeps the popup mounted after a close with the opt-out, and unmounts it on forceUnmount', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);
      host.preventUnmountOnClose.value = true;

      await setProps({ open: false });
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      expect(host.onUnmount).not.toHaveBeenCalled();

      host.result.forceUnmount();
      await nextTick();

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('clears the stored opt-out when the popup opens, and unmounts on the next close', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);
      host.preventUnmountOnClose.value = true;
      await setProps({ open: false });
      expect(host.result.mounted.value).toBe(true);

      await setProps({ open: true });

      expect(host.setPreventUnmountOnClose).toHaveBeenCalledWith(false);
      expect(host.preventUnmountOnClose.value).toBe(false);

      await setProps({ open: false });

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('gives false for preventUnmountingOnClose in the tick of an open, while the stored value is true', async () => {
      const host = createHost();
      const open = shallowRef(true);
      await render(<host.Host open={open} />);
      host.preventUnmountOnClose.value = true;
      open.value = false;
      await nextTick();
      expect(host.result.preventUnmountingOnClose.value).toBe(true);

      open.value = true;

      expect(host.result.preventUnmountingOnClose.value).toBe(false);
      expect(host.preventUnmountOnClose.value).toBe(true);

      await nextTick();

      expect(host.preventUnmountOnClose.value).toBe(false);
    });

    it('calls onUnmount one time for two forceUnmount calls in one task and for one call after the unmount', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);
      host.preventUnmountOnClose.value = true;
      await setProps({ open: false });

      host.result.forceUnmount();
      host.result.forceUnmount();
      await nextTick();
      expect(host.onUnmount).toHaveBeenCalledTimes(1);

      host.result.forceUnmount();
      await nextTick();

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: 'close first, uncontrolled', controlled: false, closeFirst: true },
      { name: 'close first, controlled', controlled: true, closeFirst: true },
      { name: 'forceUnmount first, controlled', controlled: true, closeFirst: false },
    ])('unmounts one time when $name', async ({ controlled, closeFirst }) => {
      const host = createHost();
      const open = shallowRef(true);
      host.preventUnmountOnClose.value = true;
      await render(() => <host.Host open={controlled ? open.value : open} />);

      if (closeFirst) {
        open.value = false;
        host.result.forceUnmount();
      } else {
        host.result.forceUnmount();
        open.value = false;
      }
      await nextTick();

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(host.result.mounted.value).toBe(false);
    });

    it('ignores forceUnmount while the popup is open and no close follows', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);
      const popup = screen.getByTestId('popup');

      host.result.forceUnmount();
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toBe(popup);
      expect(host.transitionStatuses).toEqual([]);
      expect(host.onUnmount).not.toHaveBeenCalled();

      await setProps({ open: false });

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
    });

    it('waits for the element to attach before it completes a close', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open showElement={false} />);

      await setProps({ open: false, showElement: false });
      await flushMicrotasks();

      expect(host.result.mounted.value).toBe(true);
      expect(host.onUnmount).not.toHaveBeenCalled();

      await setProps({ open: false, showElement: true });
      await flushMicrotasks();

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe('with animations enabled', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('keeps the popup mounted until the exit animation finishes, then unmounts it', async () => {
      const host = createHost();
      const exit = createAnimation();
      const getAnimations = vi.fn(() => [exit.animation]);
      const { setProps } = await render(<host.Host open />);
      screen.getByTestId('popup').getAnimations = getAnimations;

      await setProps({ open: false });
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalled();
      });

      expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      expect(host.result.mounted.value).toBe(true);
      expect(host.onUnmount).not.toHaveBeenCalled();

      exit.finish();
      await flushMicrotasks();

      expect(host.result.mounted.value).toBe(false);
      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('unmounts one frame after the close when the element has no animation', async () => {
      const host = createHost();
      const { setProps } = await render(<host.Host open />);
      let mountedInFrame: boolean | undefined;
      requestAnimationFrame(() => {
        mountedInFrame = host.result.mounted.value;
      });

      await setProps({ open: false });
      await waitSingleFrame();
      await flushMicrotasks();

      expect(mountedInFrame).toBe(true);
      expect(host.onUnmount).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('keeps the popup mounted and stops the wait when it opens during the exit', async () => {
      const host = createHost();
      const exit = createAnimation();
      const getAnimations = vi.fn(() => [exit.animation]);
      const { setProps } = await render(<host.Host open />);
      screen.getByTestId('popup').getAnimations = getAnimations;
      await setProps({ open: false });
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalled();
      });

      await setProps({ open: true });
      exit.finish();
      await waitSingleFrame();
      await flushMicrotasks();

      expect(host.result.mounted.value).toBe(true);
      expect(host.onUnmount).not.toHaveBeenCalled();
      expect(getAnimations).toHaveBeenCalledTimes(1);
      expect(host.transitionStatuses).toEqual(['ending', undefined]);
    });

    describe('after the host unmounts', () => {
      it('calls no callback when the host unmounts during the exit', async () => {
        const host = createHost();
        const exit = createAnimation();
        const getAnimations = vi.fn(() => [exit.animation]);
        const { setProps, unmount } = await render(<host.Host open />);
        screen.getByTestId('popup').getAnimations = getAnimations;
        await setProps({ open: false });
        await waitFor(() => {
          expect(getAnimations).toHaveBeenCalled();
        });

        unmount();
        exit.finish();
        await flushMicrotasks();

        expect(host.onUnmount).not.toHaveBeenCalled();
      });

      it('calls no callback for a request that waits when the host unmounts', async () => {
        const host = createHost();
        const open = shallowRef(true);
        const { unmount } = await render(<host.Host open={open} />);

        host.result.forceUnmount();
        open.value = false;
        unmount();
        await flushMicrotasks();

        expect(host.onUnmount).not.toHaveBeenCalled();
      });
    });

    it('completes the wait in progress when the element detaches', async () => {
      const host = createHost();
      const exit = createAnimation();
      const getAnimations = vi.fn(() => [exit.animation]);
      const { setProps } = await render(<host.Host open />);
      screen.getByTestId('popup').getAnimations = getAnimations;
      await setProps({ open: false });
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalled();
      });

      await setProps({ open: false, showElement: false });
      exit.finish();
      await flushMicrotasks();

      expect(host.onUnmount).toHaveBeenCalledTimes(1);
    });

    it('unmounts after one frame when the element has display none at the close', async () => {
      const host = createHost();
      const popupClass = randomStringValue();
      const open = shallowRef(true);
      await render(() => (
        <div>
          <style>{createExitStyle(popupClass)}</style>
          <host.Host open={open.value} popupClass={popupClass} />
        </div>
      ));
      screen.getByTestId('popup').style.display = 'none';

      open.value = false;
      await waitFor(() => {
        expect(host.onUnmount).toHaveBeenCalledTimes(1);
      });

      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('completes a close that is in progress when KeepAlive deactivates the host', async () => {
      const host = createHost();
      const popupClass = randomStringValue();
      const open = shallowRef(true);
      const showHost = shallowRef(true);
      await render(() => (
        <div>
          <style>{createExitStyle(popupClass)}</style>
          <KeepAlive>
            {showHost.value ? (
              <host.Host key="host" open={open.value} popupClass={popupClass} />
            ) : (
              <div key="other" />
            )}
          </KeepAlive>
        </div>
      ));
      const animationStarts: Event[] = [];
      screen.getByTestId('popup').addEventListener('animationstart', (event) => {
        animationStarts.push(event);
      });
      open.value = false;
      await waitFor(() => {
        expect(animationStarts).toHaveLength(1);
      });

      showHost.value = false;
      await waitFor(() => {
        expect(host.onUnmount).toHaveBeenCalledTimes(1);
      });

      showHost.value = true;
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
      expect(host.onUnmount).toHaveBeenCalledTimes(1);
    });

    it('keeps the popup mounted when the opt-out comes in a microtask after the close', async () => {
      const host = createHost();
      const exit = createAnimation();
      const open = shallowRef(true);
      await render(<host.Host open={open} />);
      screen.getByTestId('popup').getAnimations = () => [exit.animation];

      open.value = false;
      await Promise.resolve();
      host.preventUnmountOnClose.value = true;
      exit.finish();
      await waitSingleFrame();
      await flushMicrotasks();

      expect(host.result.mounted.value).toBe(true);
      expect(host.onUnmount).not.toHaveBeenCalled();
    });
  });
});
