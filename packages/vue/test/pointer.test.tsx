import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, firePointer, penDrag, screen, touchDrag, waitFor } from '#test-utils';
import { platform } from '../src/common/platform';

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
  // good as the `PointerEvent` of the browser. A `window.PointerEvent = window.MouseEvent` shim
  // drops `pointerId` and `pointerType` with no failure: each consumer keys on `'touch'` and
  // `'pen'`, so `undefined` falls the same way as `'mouse'`.
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

// Only Chromium has the protocol that the two helpers use.
describe('touchDrag and penDrag', () => {
  const { render } = createRenderer();

  async function renderTarget() {
    const seen: { type: string; pointerType: string; clientX: number; clientY: number }[] = [];
    const record = (event: PointerEvent) => {
      seen.push({
        type: event.type,
        pointerType: event.pointerType,
        clientX: Math.round(event.clientX),
        clientY: Math.round(event.clientY),
      });
    };
    await render(
      <div
        data-testid="target"
        style={{ width: '300px', height: '100px', touchAction: 'none' }}
        onPointerdown={record}
        onPointermove={record}
        onPointerup={record}
      />,
    );
    const rect = screen.getByTestId('target').getBoundingClientRect();
    return { seen, from: { x: rect.left + 20, y: rect.top + 30 } };
  }

  it.skipIf(!platform.engine.blink)('drags a real touch between two client points', async () => {
    const { seen, from } = await renderTarget();

    await touchDrag(from, { x: from.x + 60, y: from.y + 20 }, 3);

    await waitFor(() => {
      expect(seen.at(-1)?.type).toBe('pointerup');
    });
    expect(seen.every(({ pointerType }) => pointerType === 'touch')).toBe(true);
    expect(seen[0]).toMatchObject({ type: 'pointerdown', clientX: from.x, clientY: from.y });
    expect(seen.at(-1)).toMatchObject({ clientX: from.x + 60, clientY: from.y + 20 });
  });

  it.skipIf(!platform.engine.blink)('drags a real pen between two client points', async () => {
    const { seen, from } = await renderTarget();

    await penDrag(from, { x: from.x + 60, y: from.y + 20 }, 3);

    await waitFor(() => {
      expect(seen.at(-1)?.type).toBe('pointerup');
    });
    expect(seen.every(({ pointerType }) => pointerType === 'pen')).toBe(true);
    expect(seen.find(({ type }) => type === 'pointerdown')).toMatchObject({
      clientX: from.x,
      clientY: from.y,
    });
    expect(seen.at(-1)).toMatchObject({ clientX: from.x + 60, clientY: from.y + 20 });
  });
});
