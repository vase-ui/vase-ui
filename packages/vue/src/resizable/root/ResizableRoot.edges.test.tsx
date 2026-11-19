import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { nextTick, shallowRef, Teleport } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import { createRenderer, fireEvent, screen, waitFor, waitSingleFrame } from '#test-utils';

describe('automatic edges', () => {
  const { render } = createRenderer();
  const edges = () =>
    Array.from(
      screen.getByTestId('root').querySelectorAll<HTMLElement>('[data-vase-ui-resizable-edge]'),
    );

  it.each([
    { name: 'siblings with no gap', gap: 0, size: 10, expected: [[295, 305]] },
    { name: 'a gap of 16 with the size 10', gap: 16, size: 10, expected: [[300, 316]] },
    {
      name: 'a gap of 180 and no sibling',
      spacer: 180,
      size: 10,
      expected: [
        [295, 305],
        [475, 485],
      ],
    },
    { name: 'a gap of 6 and no sibling', spacer: 6, size: 10, expected: [[298, 308]] },
    { name: 'the size 0 with no gap', gap: 0, size: 0, expected: [] },
    { name: 'the size 0 and a gap of 180', spacer: 180, size: 0, expected: [] },
    { name: 'the panel before on the right', rtl: true, size: 10, expected: [[595, 605]] },
  ])('gives the areas for $name', async ({ gap, spacer, rtl, size, expected }) => {
    await render(
      <Resizable.Root
        data-testid="root"
        dir={rtl ? 'rtl' : 'ltr'}
        dragEdges
        hitAreaSize={size}
        style={{ width: '900px', height: '30px', gap: `${gap ?? 0}px` }}
      >
        <Resizable.Panel style={{ flex: '0 0 300px' }} />
        {spacer !== undefined && <div style={{ flex: `0 0 ${spacer}px` }} />}
        <Resizable.Panel />
      </Resizable.Root>,
    );
    await waitSingleFrame();
    expect(edges().map((edge) => [edge.offsetLeft, edge.offsetLeft + edge.offsetWidth])).toEqual(
      expected,
    );
  });

  it.each([
    { name: 'two panels and no handle', parts: ['a', 'b'], expected: [95] },
    { name: 'three panels and no handle', parts: ['a', 'b', 'c'], expected: [95, 195] },
    { name: 'three panels and one handle', parts: ['a', 'handle', 'b', 'c'], expected: [195] },
    { name: 'a handle between the two', parts: ['a', 'handle', 'b'], expected: [] },
    {
      name: 'a disabled panel before the boundary',
      parts: ['a', 'b'],
      disabled: 'a',
      expected: [],
    },
    { name: 'a disabled panel after the boundary', parts: ['a', 'b'], disabled: 'b', expected: [] },
    {
      name: 'a disabled panel on one side only',
      parts: ['a', 'b', 'c'],
      disabled: 'a',
      expected: [195],
    },
    {
      name: 'a disabled panel with a free panel after',
      parts: ['a', 'b', 'c'],
      disabled: 'b',
      expected: [95, 195],
    },
  ])('finds the boundaries of $name', async ({ parts, disabled, expected }) => {
    await render(
      <Resizable.Root data-testid="root" dragEdges style={{ width: '300px', height: '30px' }}>
        {parts.map((part) =>
          part === 'handle' ? (
            <Resizable.Handle key={part} />
          ) : (
            <Resizable.Panel
              key={part}
              id={part}
              disabled={part === disabled}
              style={{ flex: '0 0 100px' }}
            />
          ),
        )}
      </Resizable.Root>,
    );
    await waitSingleFrame();
    expect(edges().map((edge) => edge.offsetLeft)).toEqual(expected);
  });

  it('finds no boundary in a disabled root', async () => {
    await render(
      <Resizable.Root data-testid="root" disabled dragEdges>
        <Resizable.Panel />
        <Resizable.Panel />
        <Resizable.Panel />
      </Resizable.Root>,
    );
    await waitSingleFrame();
    expect(edges()).toHaveLength(0);
  });

  it('restores the edge when a handle leaves before its root enters the document', async () => {
    const target = document.createElement('div');
    onTestFinished(() => target.remove());
    const show = shallowRef(true);
    await render(() => (
      <Teleport to={target}>
        <Resizable.Root
          data-testid="root"
          defaultLayout={{ a: 50, b: 50 }}
          dragEdges
          style={{ width: '400px', height: '40px' }}
        >
          <Resizable.Panel id="a" />
          {show.value ? <Resizable.Handle /> : null}
          <Resizable.Panel id="b" />
        </Resizable.Root>
      </Teleport>
    ));

    show.value = false;
    await nextTick();
    document.body.append(target);

    await waitFor(() => expect(edges().map((edge) => edge.offsetLeft)).toEqual([195]));
  });

  it('cancels a preview on one edge node and commits the next drag on the other', async () => {
    const commit = vi.fn();
    await render(
      <Resizable.Root
        data-testid="root"
        dragEdges
        resizeMode="on-release"
        onLayoutCommitted={commit}
        style={{ width: '440px', height: '40px' }}
      >
        <Resizable.Panel id="a" data-testid="panel" />
        <div style={{ flex: '0 0 40px' }} />
        <Resizable.Panel id="b" />
      </Resizable.Root>,
    );
    await waitSingleFrame();
    const nodes = edges();
    expect(nodes).toHaveLength(2);
    const [first, second] = nodes as [HTMLElement, HTMLElement];
    const pointer = { pointerId: 1, pointerType: 'mouse', buttons: 1 };
    await fireEvent.pointerDown(first, { ...pointer, clientX: 100 });
    await fireEvent.pointerMove(first, { ...pointer, clientX: 140 });
    expect(second.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('40px');
    await fireEvent.pointerCancel(first, pointer);
    expect(commit).not.toHaveBeenCalled();
    expect(second).not.toHaveAttribute('data-dragging');
    expect(screen.getByTestId('panel').offsetWidth).toBe(200);

    await fireEvent.pointerDown(second, { ...pointer, clientX: 100 });
    await fireEvent.pointerMove(second, { ...pointer, clientX: 120 });
    await fireEvent.pointerUp(second, { ...pointer, buttons: 0, clientX: 120 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('panel').offsetWidth).toBe(220);
  });
});
