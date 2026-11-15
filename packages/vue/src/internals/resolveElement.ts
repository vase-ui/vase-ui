import type { ComponentPublicInstance } from 'vue';
import { warn } from '../common/warn';

function isElement(value: unknown): value is Element {
  return value != null && typeof value === 'object' && (value as Node).nodeType === 1;
}

/**
 * Changes the value of a template ref into an element.
 * An element stays the same. A component that exposes `element` gives that element.
 * Another component gives its root element, if it has one. A Vapor component has none, so it must
 * expose `element`.
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

  // The public instance of a component with no `expose` also gives its props. A `<script setup>`
  // component has such an instance only when its template is inline, as in a production build.
  // A value that is the prop of that name is thus not an exposed element.
  if ('element' in value) {
    const exposed = value.element;
    // A ref on a Vapor component gives no `$props`.
    const targetProps: Record<string, unknown> | undefined = value.$props;
    const isProp =
      targetProps != null && 'element' in targetProps && targetProps.element === exposed;
    if (!isProp) {
      if (isElement(exposed)) {
        return exposed;
      }
      // A wrapper can set the exposed `element` after its render. The root element can be the
      // wrong element, so an empty `element` gives `null`.
      if (exposed == null) {
        return null;
      }
    }
  }

  // A ref on a Vapor component gives only the values that the component exposes.
  if (!('$el' in value)) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        'The component is in Vapor mode and exposes no `element`.',
        'Vue gives a ref on a Vapor component only the values that the component exposes, so the part cannot reach its element.',
        'Expose the element as `element` in the component: `defineExpose({ element })`.',
      );
    }
    return null;
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
