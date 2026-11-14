import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, firePointer, screen } from '#test-utils';

describe('firePointer', () => {
  const { render } = createRenderer();

  const Target = defineComponent(
    (props: { onEvent: (event: PointerEvent) => void }) => {
      return () => (
        <div
          data-testid="target"
          onPointerdown={props.onEvent}
          onPointermove={props.onEvent}
          onPointerup={props.onEvent}
        />
      );
    },
    { props: ['onEvent'] },
  );

  // `timeStamp` is read-only and not a valid `PointerEventInit` member, so `fireEvent` drops it and
  // the event gets the real monotonic clock of the browser. Every gesture test that asserts on
  // velocity depends on this helper putting the requested value back. Without it, such a test
  // reverts to real-clock timing and does not fail.
  it('reports the requested timeStamp to React handlers', async () => {
    const seen: number[] = [];
    await render(<Target onEvent={(event) => seen.push(event.timeStamp)} />);
    const target = screen.getByTestId('target');

    await firePointer.down(target, { pointerId: 1, timeStamp: 1000 });
    await firePointer.move(target, { pointerId: 1, timeStamp: 1050 });
    await firePointer.up(target, { pointerId: 1, timeStamp: 1100 });

    expect(seen).toEqual([1000, 1050, 1100]);
  });

  // The rest of the init reaches the event through the constructor of `createEvent`. It is only as
  // good as the `PointerEvent` of the browser. A stale `window.PointerEvent = window.MouseEvent`
  // shim once dropped `pointerId` and `pointerType` with no failure: each consumer keys on
  // `'touch'` and `'pen'`, so `undefined` falls the same way as `'mouse'`.
  it('delivers the rest of the init alongside the timeStamp', async () => {
    const seen: Record<string, unknown>[] = [];
    await render(
      <Target
        onEvent={(event) =>
          seen.push({
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            clientX: event.clientX,
            clientY: event.clientY,
            buttons: event.buttons,
            timeStamp: event.timeStamp,
          })
        }
      />,
    );

    await firePointer.move(screen.getByTestId('target'), {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 40,
      buttons: 1,
      timeStamp: 1050,
    });

    expect(seen).toEqual([
      {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 120,
        clientY: 40,
        buttons: 1,
        timeStamp: 1050,
      },
    ]);
  });

  it('rejects a non-positive timeStamp instead of falling back to the real clock', async () => {
    const seen: number[] = [];
    await render(<Target onEvent={(event) => seen.push(event.timeStamp)} />);
    const target = screen.getByTestId('target');

    expect(() => firePointer.down(target, { pointerId: 1, timeStamp: 0 })).toThrow(
      /timeStamp must be greater than 0/,
    );
    expect(seen).toEqual([]);
  });
});
