import type { ComponentPublicInstance, ShallowRef } from 'vue';
import { resolveElement } from '../../internals/resolveElement';

/**
 * Makes the `ref` setter of a part that gives its element to a ref of the root. The setter takes
 * an element or a component that exposes `element`.
 *
 * A template can mount a part that replaces another part before it unmounts that part. The setter
 * thus clears the ref only when the ref holds the element of its own part.
 */
export function createElementSetter(target: ShallowRef<HTMLElement | null>) {
  let ownElement: HTMLElement | null = null;

  return (value: Element | ComponentPublicInstance | null) => {
    const element = resolveElement(value) as HTMLElement | null;
    if (element !== null || target.value === ownElement) {
      target.value = element;
    }
    ownElement = element;
  };
}
