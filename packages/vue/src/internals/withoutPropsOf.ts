import { camelize } from 'vue';
import type { Component } from 'vue';

/**
 * Returns a new object with the attributes whose names match no prop of the component.
 * Bind the result before the props of the part. Call this in the template so each render
 * reads the current `$attrs`. A computed value cannot track changes to `$attrs`.
 */
export function withoutPropsOf(
  attrs: Record<string, unknown>,
  component: Component,
): Record<string, unknown> {
  // Vue compiles the typed props of a part to an object. Some `Component` types omit this option.
  // https://vuejs.org/api/options-state.html#props
  const props = (component as { props?: Record<string, unknown> }).props ?? {};
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !Object.hasOwn(props, camelize(key))),
  );
}
