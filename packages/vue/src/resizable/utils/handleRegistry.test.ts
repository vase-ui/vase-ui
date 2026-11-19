import { describe, expect, it, onTestFinished } from 'vitest';
import type { Orientation } from '../../internals/types';
import type { HandleDrag } from './useResizeHandle';
import {
  getHandlesAtPoint,
  getJoinBox,
  getNearestPoint,
  isInBox,
  registerHandle,
} from './useResizeHandle';

describe('handle registry', () => {
  it('join box: the box of the handle grows by half of the size on each side', () => {
    const box = getJoinBox({ left: 196, right: 204, top: 0, bottom: 100 }, 10);

    expect(box).toEqual({ left: 191, right: 209, top: -5, bottom: 105 });
  });

  it('join box: the size 0 gives the box of the handle', () => {
    const rect = { left: 196, right: 204, top: 0, bottom: 100 };

    expect(getJoinBox(rect, 0)).toEqual(rect);
  });

  it('point: in the box, on its border, and outside', () => {
    const box = { left: 0, right: 10, top: 0, bottom: 10 };

    expect(isInBox(box, 5, 5)).toBe(true);
    expect(isInBox(box, 10, 0)).toBe(true);
    expect(isInBox(box, 10.5, 5)).toBe(false);
  });

  it('nearest point: a point beside the box goes to its border, and inside the right and bottom borders', () => {
    const box = { left: 204, right: 400, top: 46, bottom: 54 };

    expect(getNearestPoint(box, 500, 60)).toEqual({ x: 399.5, y: 53.5 });
    expect(getNearestPoint(box, 200, 50)).toEqual({ x: 204, y: 50 });
    expect(getNearestPoint(box, 300, 50)).toEqual({ x: 300, y: 50 });
  });

  describe('in the document', () => {
    function createDrag(disabled = false): HandleDrag {
      return {
        disabled: () => disabled,
        start: () => true,
        move() {},
        end() {},
      };
    }

    interface Rectangle {
      left: number;
      top: number;
      width: number;
      height: number;
    }

    function place(parent: Element, rectangle: Rectangle, position = 'absolute') {
      const element = document.createElement('div');
      Object.assign(element.style, {
        position,
        left: `${rectangle.left}px`,
        top: `${rectangle.top}px`,
        width: `${rectangle.width}px`,
        height: `${rectangle.height}px`,
      });
      parent.append(element);
      return element;
    }

    function createContainer() {
      const container = document.createElement('div');
      Object.assign(container.style, { position: 'relative', width: '400px', height: '300px' });
      document.body.append(container);
      onTestFinished(() => {
        container.remove();
      });
      return container;
    }

    // A column is the handle of a horizontal root, and a row is the handle of a vertical root.
    function createHandle(
      parent: Element,
      orientation: Orientation,
      rectangle: Rectangle,
      options: { drag?: HandleDrag; size?: number } = {},
    ) {
      const { drag = createDrag(), size = 10 } = options;
      const element = place(parent, rectangle);
      const hitArea = document.createElement('span');
      Object.assign(hitArea.style, {
        position: 'absolute',
        zIndex: '1',
        ...(orientation === 'horizontal'
          ? {
              top: '0',
              bottom: '0',
              left: '50%',
              width: `max(100%, ${size}px)`,
              translate: '-50% 0',
            }
          : {
              left: '0',
              right: '0',
              top: '50%',
              height: `max(100%, ${size}px)`,
              translate: '0 -50%',
            }),
      });
      element.append(hitArea);
      const own = { drag, orientation: () => orientation };
      const unregister = registerHandle(
        { element, drag, orientation: own.orientation, hitAreaSize: () => size },
        hitArea,
      );
      onTestFinished(unregister);
      return { element, hitArea, drag, own, unregister };
    }

    // The column is 8 px wide at x 100 to 108. The row starts at its right border, at y 96 to 104.
    function createCrossing(container: Element) {
      const column = createHandle(container, 'horizontal', {
        left: 100,
        top: 0,
        width: 8,
        height: 200,
      });
      const row = createHandle(container, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      return { column, row };
    }

    function pointOf(element: Element, x: number, y: number) {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + x, y: rect.top + y };
    }

    it('joins the column that has the point in its box, with the pressed row first', () => {
      const container = createContainer();
      const { column, row } = createCrossing(container);
      // The point is 3 px right of the column, so only its join box has it.
      const { x, y } = pointOf(container, 111, 100);

      const drags = getHandlesAtPoint(row.own, row.element, x, y);

      expect(drags).toEqual([row.drag, column.drag]);
    });

    it('joins nothing when the point is out of the join box', () => {
      const container = createContainer();
      const { row } = createCrossing(container);
      const { x, y } = pointOf(container, 114, 100);

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag]);
    });

    it('does not join a handle of the same orientation', () => {
      const container = createContainer();
      const first = createHandle(container, 'horizontal', {
        left: 100,
        top: 0,
        width: 8,
        height: 200,
      });
      createHandle(container, 'horizontal', { left: 112, top: 0, width: 8, height: 200 });
      const { x, y } = pointOf(container, 110, 100);

      expect(getHandlesAtPoint(first.own, first.element, x, y)).toEqual([first.drag]);
    });

    it('does not join a disabled handle', () => {
      const container = createContainer();
      const column = createHandle(
        container,
        'horizontal',
        { left: 100, top: 0, width: 8, height: 200 },
        { drag: createDrag(true) },
      );
      const row = createHandle(container, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      const { x, y } = pointOf(container, 106, 100);

      expect(column.drag.disabled()).toBe(true);
      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag]);
    });

    it('does not join a handle that an element which is not a handle covers', () => {
      const container = createContainer();
      const { row } = createCrossing(container);
      const box = container.getBoundingClientRect();
      const cover = place(
        container,
        { left: box.left + 90, top: box.top + 80, width: 40, height: 40 },
        'fixed',
      );
      // The hit area of a handle has the level 1.
      cover.style.zIndex = '2';
      const { x, y } = pointOf(container, 106, 100);

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag]);
    });

    it('does not join the handle under a layer when the press is on a handle of the layer', () => {
      const container = createContainer();
      const { column } = createCrossing(container);
      const layer = place(container, { left: 0, top: 0, width: 400, height: 300 }, 'absolute');
      layer.style.zIndex = '2';
      layer.style.background = 'white';
      const layerRow = createHandle(layer, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      const { x, y } = pointOf(container, 106, 100);

      expect(column.drag.disabled()).toBe(false);
      expect(getHandlesAtPoint(layerRow.own, layerRow.element, x, y)).toEqual([layerRow.drag]);
    });

    it('gives the drag of two nodes that share it one time', () => {
      const container = createContainer();
      const edge = createDrag();
      createHandle(
        container,
        'horizontal',
        { left: 100, top: 0, width: 8, height: 200 },
        { drag: edge },
      );
      createHandle(
        container,
        'horizontal',
        { left: 112, top: 0, width: 8, height: 200 },
        { drag: edge },
      );
      const row = createHandle(container, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      const { x, y } = pointOf(container, 109, 100);

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag, edge]);
    });

    it('does not join a handle in another shadow root', () => {
      const container = createContainer();
      const host = place(container, { left: 0, top: 0, width: 400, height: 300 });
      const shadow = host.attachShadow({ mode: 'open' });
      createHandle(shadow as unknown as Element, 'horizontal', {
        left: 100,
        top: 0,
        width: 8,
        height: 200,
      });
      const row = createHandle(container, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      const { x, y } = pointOf(container, 106, 100);

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag]);
    });

    it('joins a handle in the same shadow root', () => {
      const container = createContainer();
      const host = place(container, { left: 0, top: 0, width: 400, height: 300 });
      const shadow = host.attachShadow({ mode: 'open' });
      const column = createHandle(shadow as unknown as Element, 'horizontal', {
        left: 100,
        top: 0,
        width: 8,
        height: 200,
      });
      const row = createHandle(shadow as unknown as Element, 'vertical', {
        left: 108,
        top: 96,
        width: 200,
        height: 8,
      });
      const { x, y } = pointOf(container, 106, 100);

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag, column.drag]);
    });

    it('presses only its own drag for an element that is not in a document', () => {
      const element = document.createElement('div');
      const drag = createDrag();

      expect(getHandlesAtPoint({ drag, orientation: () => 'vertical' }, element, 5, 5)).toEqual([
        drag,
      ]);
    });

    it('removes the handle at the cleanup', () => {
      const container = createContainer();
      const { column, row } = createCrossing(container);
      const { x, y } = pointOf(container, 106, 100);
      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag, column.drag]);

      column.unregister();

      expect(getHandlesAtPoint(row.own, row.element, x, y)).toEqual([row.drag]);
    });
  });
});
