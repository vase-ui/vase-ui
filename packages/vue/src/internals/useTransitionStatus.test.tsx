import { expect, describe, it, vi, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { AnimationFrame } from '../common/useAnimationFrame';
import { useTransitionStatus } from './useTransitionStatus';

interface TestProps {
  open: boolean;
  enableIdleState?: boolean | undefined;
  deferEndingState?: boolean | undefined;
  animateInitialOpen?: boolean | undefined;
}

describe('useTransitionStatus', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  let setMountedByTest: (mounted: boolean) => void;

  const Test = defineComponent(
    (props: TestProps) => {
      const { transitionStatus, setMounted } = useTransitionStatus(
        () => props.open,
        props.enableIdleState,
        props.deferEndingState,
        props.animateInitialOpen,
      );
      setMountedByTest = setMounted;
      return () => <div data-testid="status" data-status={transitionStatus.value ?? 'none'} />;
    },
    { props: ['open', 'enableIdleState', 'deferEndingState', 'animateInitialOpen'] },
  );

  function mockFrames() {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    return frames;
  }

  it('does not request a frame for an element that mounts already open', async () => {
    const requestSpy = vi.spyOn(AnimationFrame, 'request');

    await render(<Test open />);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('clears the starting status on the next frame after opening', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const { setProps } = await render(<Test open={false} />);
    await setProps({ open: true });

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'starting');
    expect(frames).toHaveLength(1);

    frames[0](0);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });

  it('clears a stale ending status when reopened before the exit settles', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const { setProps } = await render(<Test open />);
    await setProps({ open: false });
    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'ending');

    await setProps({ open: true });
    expect(frames).toHaveLength(1);

    frames[0](0);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });

  it('starts as idle for an element that mounts already open with the idle state enabled', async () => {
    mockFrames();

    await render(<Test open enableIdleState />);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'idle');
  });

  it('gives the idle status on the next frame after opening with the idle state enabled', async () => {
    const frames = mockFrames();

    const { setProps } = await render(<Test open={false} enableIdleState />);
    await setProps({ open: true });

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'starting');
    expect(frames).toHaveLength(1);

    frames[0](0);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'idle');
  });

  it('gives the ending status on the next frame after closing with a deferred ending state', async () => {
    const frames = mockFrames();

    const { setProps } = await render(<Test open deferEndingState />);
    await setProps({ open: false });

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
    expect(frames).toHaveLength(1);

    frames[0](0);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'ending');
  });

  it('gives the starting status at mount and clears it on the next frame with animateInitialOpen', async () => {
    const frames = mockFrames();

    await render(<Test open animateInitialOpen />);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'starting');
    expect(frames).toHaveLength(1);

    frames[0](0);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });

  it('clears the ending status when the element unmounts after closing', async () => {
    mockFrames();

    const { setProps } = await render(<Test open />);
    await setProps({ open: false });
    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'ending');

    setMountedByTest(false);
    await flushMicrotasks();

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });
});
