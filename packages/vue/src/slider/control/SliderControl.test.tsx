import { expect, describe, it, onTestFinished, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Slider } from '@vase-ui/vue/slider';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { ownerDocument } from '../../common/owner';

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
