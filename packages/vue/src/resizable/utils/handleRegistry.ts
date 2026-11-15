import type { Orientation } from '../../internals/types';
import type { HandleDrag } from './handleDrag';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box in which a press joins the drag of a handle or an edge of another root: the box of the
 * handle element or of the edge node, grown by half of the hit area size of its root on each side.
 * A press that is that near to two handles is at their crossing.
 */
export function getJoinBox(box: Box, size: number): Box {
  const half = size / 2;
  return {
    left: box.left - half,
    top: box.top - half,
    right: box.right + half,
    bottom: box.bottom + half,
  };
}

export function isInBox(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * The point inside `box` that is nearest to the point (x, y).
 */
export function getNearestPoint(box: Box, x: number, y: number): { x: number; y: number } {
  // A hit test does not find an element at its right border or at its bottom border.
  const insetX = Math.min((box.right - box.left) / 2, 0.5);
  const insetY = Math.min((box.bottom - box.top) / 2, 0.5);
  return {
    x: Math.min(Math.max(x, box.left), box.right - insetX),
    y: Math.min(Math.max(y, box.top), box.bottom - insetY),
  };
}

export interface RegisteredHandle {
  /**
   * The handle element or the edge node: the element that has the pointer listeners.
   */
  element: Element;
  /**
   * The drag that a press on the element starts. The two nodes of an edge share one drag.
   */
  drag: HandleDrag;
  /**
   * The orientation of the root of the handle.
   */
  orientation: () => Orientation;
  /**
   * The hit area size of the root of the handle, in pixels.
   */
  hitAreaSize: () => number;
}

/**
 * The handle or the edge that a press is on: its drag, and the orientation of its root.
 */
export interface PressedHandle {
  drag: HandleDrag;
  orientation: () => Orientation;
}

type ElementsFromPointRoot = Node & Partial<Pick<Document, 'elementsFromPoint'>>;

const handles = new Set<RegisteredHandle>();
// The element of each handle, its hit area node and each edge node. A press on one of them is a
// press on a handle, so such a node does not cover another handle.
const nodes = new WeakSet<Element>();

/**
 * Adds a handle or an edge node to the registry. It gives the function that removes it.
 */
export function registerHandle(handle: RegisteredHandle, hitArea?: Element | null): () => void {
  handles.add(handle);
  nodes.add(handle.element);
  if (hitArea) {
    nodes.add(hitArea);
  }
  return () => {
    handles.delete(handle);
    nodes.delete(handle.element);
    if (hitArea) {
      nodes.delete(hitArea);
    }
  };
}

function isHandleNode(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (nodes.has(node)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether an element that is not a handle is above `handle` at the point. A dialog over the page
 * covers the handles of the page, and a press in the dialog is then not for them. A node of another
 * handle, such as its hit area, does not cover the handle.
 */
function isCovered(handle: RegisteredHandle, elementsAtPoint: readonly Element[]) {
  for (const element of elementsAtPoint) {
    if (handle.element.contains(element)) {
      return false;
    }
    if (!isHandleNode(element)) {
      return true;
    }
  }
  // A list with no element of the handle means that something hides it, such as an ancestor that
  // clips its content.
  return true;
}

/**
 * The drags that a press at (x, y) on `own` starts: the drag of `own` first, then the drag of each
 * handle and each edge of another root that the press crosses. Another handle joins when it can
 * move, the point is in its join box, and no other element covers it at its nearest point. With
 * no handle of the other orientation in the result, the press drags only `own`: a crossing has the
 * two axes.
 * @param element The element that has the listener of the press.
 */
export function getHandlesAtPoint(
  own: PressedHandle,
  element: Element,
  x: number,
  y: number,
): HandleDrag[] {
  const root: ElementsFromPointRoot = element.getRootNode();
  if (typeof root.elementsFromPoint !== 'function') {
    return [own.drag];
  }
  const found = new Set<HandleDrag>();
  let crossing = false;
  for (const handle of handles) {
    if (
      handle.drag === own.drag ||
      found.has(handle.drag) ||
      handle.drag.disabled() ||
      handle.element.getRootNode() !== root
    ) {
      continue;
    }
    const rect = handle.element.getBoundingClientRect();
    if (!isInBox(getJoinBox(rect, handle.hitAreaSize()), x, y)) {
      continue;
    }
    const near = getNearestPoint(rect, x, y);
    if (!isCovered(handle, root.elementsFromPoint(near.x, near.y))) {
      found.add(handle.drag);
      crossing ||= handle.orientation() !== own.orientation();
    }
  }
  return crossing ? [own.drag, ...found] : [own.drag];
}
