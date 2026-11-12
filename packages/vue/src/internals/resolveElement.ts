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

  // The public instance of a component with no `expose` answers `in` for its props too,
  // so `element` can be a prop of another type.
  // A wrapper can set the exposed `element` after its render. The root element can be the wrong
  // element, so an empty `element` gives `null`.
  if ('element' in value) {
    const exposed = value.element;
    if (isElement(exposed)) {
      return exposed;
    }
    if (exposed == null) {
      return null;
    }
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
