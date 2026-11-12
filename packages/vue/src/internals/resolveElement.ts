import type { ComponentPublicInstance } from 'vue';
import { warn } from '../common/warn';

function isElement(value: unknown): value is Element {
  return value != null && typeof value === 'object' && (value as Node).nodeType === 1;
}

/**
 * Changes the value of a template ref into an element.
 * An element stays the same. A component that exposes `element` gives that element.
 * Another component gives its root element, if it has one.
 */
export function resolveElement(
  value: Element | ComponentPublicInstance | null | undefined,
): Element | null {
  if (value == null) {
    return null;
  }

  if (isElement(value)) {
    return value;
  }

  // A wrapper can set `element` after its render, so the root element can be the wrong element.
  if ('element' in value) {
    return isElement(value.element) ? value.element : null;
  }

  if (isElement(value.$el)) {
    return value.$el;
  }

  if (process.env.NODE_ENV !== 'production') {
    warn(
      'The component has no single root element, because it renders a fragment, a text or a comment.',
      'The part then cannot reach its element.',
      'Render one root element in the component, or expose the element as `element`.',
    );
  }

  return null;
}
