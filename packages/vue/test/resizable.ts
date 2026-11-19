import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';

/** A part of `ResizableLayout.vue`. */
export interface LayoutPart {
  kind: 'panel' | 'handle' | 'element';
  key: string;
  attrs?: Record<string, unknown>;
  /** The ids of buttons in the part. */
  controls?: string[];
  text?: string;
  /** A root in the panel. */
  inner?: LayoutSpec;
  /** `false` takes the part out. */
  show?: boolean;
}

export interface LayoutSpec {
  /** The style of the frame around the root. */
  frame?: string;
  root?: Record<string, unknown>;
  parts: LayoutPart[];
}

/** Panels `a`, `b`, … with a handle `h1`, `h2`, … between each two. */
export function panelsAndHandles(...ids: string[]): LayoutPart[] {
  return ids.flatMap((key, index) => [
    ...(index > 0 ? [{ kind: 'handle' as const, key: `h${index}` }] : []),
    { kind: 'panel' as const, key },
  ]);
}

/** The part with the key. */
export function part(spec: LayoutSpec, key: string): LayoutPart {
  return spec.parts.find((each) => each.key === key)!;
}

export function byKey(root: ParentNode, key: string) {
  return root.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
}

/** The `flex-grow` of each panel, by key. */
export function grows(root: ParentNode, ...keys: string[]) {
  return keys.map((key) => byKey(root, key).style.flexGrow);
}

export function widthOf(element: Element) {
  return element.getBoundingClientRect().width;
}

export function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Presses the element at its center with the main button of the mouse, and holds it. */
export async function press(element: Element, at = centerOf(element)) {
  await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
  return at;
}

export async function moveTo(point: { x: number; y: number }) {
  await userEvent.pointer({ coords: point });
}

export async function release() {
  await userEvent.pointer({ keys: '[/MouseLeft]' });
  await nextTick();
}

/** Drags the element from its center by a distance, and releases it. */
export async function drag(element: Element, x: number, y = 0) {
  const start = await press(element);
  await moveTo({ x: start.x + x, y: start.y + y });
  await release();
}

/** Presses a key on the element, after it takes the focus. */
export async function key(element: HTMLElement, keys: string) {
  element.focus();
  await userEvent.keyboard(keys);
  await nextTick();
}

/**
 * A double click on the element. A handle can have no size, and a click of the browser needs an
 * element that it can see.
 */
export async function doubleClick(element: Element) {
  element.dispatchEvent(
    new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, button: 0 }),
  );
  await nextTick();
}

/** Waits for the root to read a new size of the page: an observer reads it in a frame. */
export async function frames(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  await nextTick();
}
