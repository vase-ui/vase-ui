import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, waitFor } from '#test-utils';
import { useOpenChangeComplete } from './useOpenChangeComplete';

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

interface TestProps {
  onComplete: () => void;
  open?: boolean | undefined;
  enabled?: boolean | undefined;
  restartKey?: unknown;
  getAnimations?: (() => Animation[]) | undefined;
}

describe('useOpenChangeComplete', () => {
  const { render } = createRenderer();

  const Test = defineComponent(
    (props: TestProps) => {
      const element = shallowRef<HTMLDivElement | null>(null);

      onMounted(() => {
        if (element.value && props.getAnimations) {
          element.value.getAnimations = props.getAnimations;
        }
      });

      useOpenChangeComplete({
        enabled: () => props.enabled,
        open: () => props.open,
        ref: element,
        restartKey: () => props.restartKey,
        onComplete: props.onComplete,
      });

      return () => <div ref={element} />;
    },
    { props: ['onComplete', 'open', 'enabled', 'restartKey', 'getAnimations'] },
  );

  describe('with animations disabled', () => {
    it('calls onComplete one time after mount', async () => {
      const onComplete = vi.fn();

      await render(<Test onComplete={onComplete} />);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('starts a new wait when open changes', async () => {
      const onComplete = vi.fn();

      const { setProps } = await render(<Test open={false} onComplete={onComplete} />);
      expect(onComplete).toHaveBeenCalledTimes(1);

      await setProps({ open: true });

      expect(onComplete).toHaveBeenCalledTimes(2);
    });

    it('starts a new wait when restartKey changes', async () => {
      const onComplete = vi.fn();

      const { setProps } = await render(<Test restartKey={0} onComplete={onComplete} />);
      expect(onComplete).toHaveBeenCalledTimes(1);

      await setProps({ restartKey: 1 });

      expect(onComplete).toHaveBeenCalledTimes(2);
    });

    it('starts no wait while it is disabled, and starts one when it becomes enabled', async () => {
      const onComplete = vi.fn();

      const { setProps } = await render(<Test enabled={false} onComplete={onComplete} />);
      expect(onComplete).not.toHaveBeenCalled();

      await setProps({ enabled: true });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('with animations enabled', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('stops the wait in progress when open changes', async () => {
      const oldAnimation = createAnimation();
      const newAnimation = createAnimation();
      let animations = [oldAnimation.animation];
      const getAnimations = vi.fn(() => animations);
      const onComplete = vi.fn();

      const { setProps } = await render(
        <Test open={false} getAnimations={getAnimations} onComplete={onComplete} />,
      );
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalledTimes(1);
      });

      animations = [newAnimation.animation];
      await setProps({ open: true });
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalledTimes(2);
      });

      oldAnimation.finish();
      await flushMicrotasks();
      expect(onComplete).not.toHaveBeenCalled();

      newAnimation.finish();
      await flushMicrotasks();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('stops the wait in progress when the component unmounts', async () => {
      const animation = createAnimation();
      const getAnimations = vi.fn(() => [animation.animation]);
      const onComplete = vi.fn();

      const { unmount } = await render(
        <Test open getAnimations={getAnimations} onComplete={onComplete} />,
      );
      await waitFor(() => {
        expect(getAnimations).toHaveBeenCalledTimes(1);
      });
      expect(onComplete).not.toHaveBeenCalled();

      unmount();
      animation.finish();
      await flushMicrotasks();

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
