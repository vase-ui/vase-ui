import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  createRenderer,
  flushMicrotasks,
  screen,
  touchDrag,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { platform } from '../../common/platform';
import * as Resizable from '../index.parts';

// The pointer of the browser stays where a case leaves it, for each later test. A call with no
// coordinates would move the pointer to the element of the last press, which is gone by then.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<Resizable.Root /> with the pointer of the browser', () => {
  const { render } = createRenderer();

  const edgesOf = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-vase-ui-resizable-edge]'));

  const centerOf = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  // The root is 400 px wide and 100 px high, so 1% of the panel space is 4 px.
  async function renderEdges(
    content: unknown = [
      <Resizable.Panel key="a" id="a" data-testid="first" />,
      <Resizable.Panel key="b" id="b" data-testid="second" />,
    ],
    root: Record<string, unknown> = {},
  ) {
    await render(
      <div style={{ width: '400px', height: '100px' }}>
        <Resizable.Root data-testid="root" dragEdges style={{ height: '100%' }} {...root}>
          {content}
        </Resizable.Root>
      </div>,
    );
    const rootElement = screen.getByTestId('root');
    await waitFor(() => {
      expect(edgesOf(rootElement).length).toBeGreaterThan(0);
    });
    return { root: rootElement, edges: edgesOf(rootElement) };
  }

  const widthOf = (testId: string) => screen.getByTestId(testId).getBoundingClientRect().width;

  it('moves the layout with a drag at the boundary of two panels that have no handle', async () => {
    const { edges } = await renderEdges();
    const at = centerOf(edges[0] as HTMLElement);
    const before = widthOf('first');
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });
    expect(edges[0]).toHaveAttribute('data-dragging');
    expect(widthOf('first') - before).toBeCloseTo(60, 0);
    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(edges[0]).not.toHaveAttribute('data-dragging');
    expect(widthOf('first') - before).toBeCloseTo(60, 0);
  });

  it('selects no text when the pointer crosses a paragraph', async () => {
    const { edges } = await renderEdges([
      <Resizable.Panel key="a" id="a" data-testid="first">
        <p style={{ margin: 0 }}>
          The first panel has this text, and a drag across it selects none.
        </p>
      </Resizable.Panel>,
      <Resizable.Panel key="b" id="b" data-testid="second">
        <p style={{ margin: 0 }}>The second panel has this text too, for the end of the drag.</p>
      </Resizable.Panel>,
    ]);
    const at = centerOf(edges[0] as HTMLElement);
    const before = widthOf('first');
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });
    await userEvent.pointer({ coords: { x: at.x + 120, y: at.y + 10 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(widthOf('first') - before).toBeCloseTo(120, 0);
    expect(window.getSelection()?.toString()).toBe('');
  });

  describe('an element between the panels', () => {
    async function renderBetween() {
      const onClick = vi.fn();
      const rendered = await renderEdges([
        <Resizable.Panel key="a" id="a" data-testid="first" />,
        <button
          key="x"
          data-testid="between"
          type="button"
          style={{ width: '180px', flex: 'none' }}
          onClick={onClick}
        >
          Between
        </button>,
        <Resizable.Panel key="b" id="b" data-testid="second" />,
      ]);
      await waitFor(() => {
        expect(edgesOf(rendered.root)).toHaveLength(2);
      });
      return { onClick, ...rendered, edges: edgesOf(rendered.root) };
    }

    it('lets a click reach the element, and starts no drag', async () => {
      const { onClick, root } = await renderBetween();
      releasePointerAfterTest();

      await userEvent.pointer({
        coords: centerOf(screen.getByTestId('between')),
        keys: '[MouseLeft]',
      });

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(root).not.toHaveAttribute('data-dragging');
    });

    it('starts a drag with a press on the panel edge beside the element', async () => {
      const { edges, root } = await renderBetween();
      const before = widthOf('first');
      releasePointerAfterTest();

      const at = centerOf(edges[0] as HTMLElement);
      await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: at.x + 40, y: at.y } });

      expect(root).toHaveAttribute('data-dragging');
      expect(widthOf('first') - before).toBeCloseTo(40, 0);
    });
  });

  it('moves both layouts with a press at the crossing of an edge and a handle of a nested root', async () => {
    // The outer root is 408 px wide, so 1% of its panel space is 4 px. The inner root is 308 px
    // high with a handle of 8 px, so 1% of its panel space is 3 px.
    const onInnerCommitted = vi.fn();
    const onOuterCommitted = vi.fn();
    await render(
      <div style={{ width: '408px', height: '308px' }}>
        <Resizable.Root
          data-testid="outer"
          dragEdges
          style={{ height: '100%' }}
          onLayoutCommitted={onOuterCommitted}
        >
          <Resizable.Panel id="left" data-testid="left" />
          <Resizable.Panel id="right">
            <Resizable.Root
              orientation="vertical"
              style={{ height: '100%' }}
              onLayoutCommitted={onInnerCommitted}
            >
              <Resizable.Panel id="top" data-testid="top" />
              <Resizable.Handle
                data-testid="inner-handle"
                style={{ flex: 'none', height: '8px' }}
              />
              <Resizable.Panel id="bottom" />
            </Resizable.Root>
          </Resizable.Panel>
        </Resizable.Root>
      </div>,
    );
    await waitFor(() => {
      expect(edgesOf(screen.getByTestId('outer'))).toHaveLength(1);
    });
    const edge = edgesOf(screen.getByTestId('outer'))[0] as HTMLElement;
    const row = screen.getByTestId('inner-handle').getBoundingClientRect();
    const at = { x: centerOf(edge).x, y: row.top + row.height / 2 };
    const leftBefore = widthOf('left');
    const topBefore = screen.getByTestId('top').getBoundingClientRect().height;
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 40, y: at.y + 30 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(widthOf('left') - leftBefore).toBeCloseTo(40, 0);
    expect(screen.getByTestId('top').getBoundingClientRect().height - topBefore).toBeCloseTo(30, 0);
    expect(onOuterCommitted).toHaveBeenCalledTimes(1);
    expect(onInnerCommitted).toHaveBeenCalledTimes(1);
  });

  it('runs a click listener of the root after a press with no move on the edge, and not after a drag', async () => {
    const onClick = vi.fn();
    const { edges } = await renderEdges(undefined, { onClick });
    const at = centerOf(edges[0] as HTMLElement);
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(onClick).not.toHaveBeenCalled();

    const moved = centerOf(edges[0] as HTMLElement);
    await userEvent.pointer({ coords: moved, keys: '[MouseLeft]' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps each panel where it is during an on-release drag, shows the distance, and moves the layout at the release', async () => {
    const { edges } = await renderEdges(undefined, { resizeMode: 'on-release' });
    const edge = edges[0] as HTMLElement;
    const at = centerOf(edge);
    const first = screen.getByTestId('first').getBoundingClientRect();
    const second = screen.getByTestId('second').getBoundingClientRect();
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });

    expect(screen.getByTestId('first').getBoundingClientRect()).toEqual(first);
    expect(screen.getByTestId('second').getBoundingClientRect()).toEqual(second);
    expect(edge.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('60px');
    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(widthOf('first') - first.width).toBeCloseTo(60, 0);
    expect(edge.style.getPropertyValue('--resizable-handle-preview-offset')).toBe('');
  });

  it.skipIf(!platform.engine.blink)(
    'moves the layout with a touch drag on the edge, and the browser cancels no pointer',
    async () => {
      const onPointercancel = vi.fn();
      const { edges } = await renderEdges(undefined, { onPointercancel });
      const at = centerOf(edges[0] as HTMLElement);
      const before = widthOf('first');

      await touchDrag(at, { x: at.x + 60, y: at.y });
      // A touch drag ends in a frame after the last move.
      await waitSingleFrame();
      await flushMicrotasks();

      expect(widthOf('first') - before).toBeCloseTo(60, 0);
      expect(onPointercancel).not.toHaveBeenCalled();
    },
  );
});
