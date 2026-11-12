import { computed, isVNode, shallowRef, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { error } from './error';

export interface UseControlledProps<T = unknown> {
  /**
   * Gives the component value when it is controlled.
   */
  controlled: () => T | undefined;
  /**
   * Gives the default value when uncontrolled, and the fallback if a controlled value later becomes `undefined`.
   */
  default: () => T | undefined;
  /**
   * The component name displayed in warnings.
   */
  name: string;
  /**
   * The name of the state variable displayed in warnings.
   */
  state?: string | undefined;
}

// A defined default guarantees a defined value. Otherwise, preserve `undefined`,
// including when callers pass an explicit generic argument.
export function useControlled<T = unknown>(
  props: Omit<UseControlledProps<T>, 'default'> & { default: () => T },
): [ComputedRef<T>, (newValue: T) => void];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [ComputedRef<T | undefined>, (newValue: T | undefined) => void];
export function useControlled<T = unknown>({
  controlled,
  default: getDefault,
  name,
  state = 'value',
}: UseControlledProps<T>): [ComputedRef<T | undefined>, (newValue: T | undefined) => void] {
  const isControlled = controlled() !== undefined;
  const defaultValue = getDefault();
  // A `shallowRef` stores a function value as it is.
  const valueState = shallowRef(defaultValue);
  // Keep the initial mode, but use the initial default if a controlled value disappears.
  // This preserves the defined-default overload while the mode-switch warning is emitted below.
  const value = computed(() => {
    const controlledValue = controlled();
    return isControlled && controlledValue !== undefined ? controlledValue : valueState.value;
  });

  if (process.env.NODE_ENV !== 'production') {
    watch(
      () => controlled() !== undefined,
      (isNowControlled) => {
        if (isControlled !== isNowControlled) {
          error(
            [
              `A component is changing the ${
                isControlled ? '' : 'un'
              }controlled ${state} state of ${name} to be ${isControlled ? 'un' : ''}controlled.`,
              'Elements should not switch from uncontrolled to controlled (or vice versa).',
              `Decide between using a controlled or uncontrolled ${name} ` +
                'element for the lifetime of the component.',
              "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
            ].join('\n'),
          );
        }
      },
    );

    watch(getDefault, (newDefault) => {
      if (
        !isControlled &&
        serializeToDevModeString(defaultValue) !== serializeToDevModeString(newDefault)
      ) {
        error(
          [
            `A component is changing the default ${state} state of an uncontrolled ${name} after being initialized. ` +
              `To suppress this warning opt to use a controlled ${name}.`,
          ].join('\n'),
        );
      }
    });
  }

  function setValueIfUncontrolled(newValue: T | undefined) {
    if (!isControlled) {
      valueState.value = newValue;
    }
  }

  return [value, setValueIfUncontrolled];
}

function serializeToDevModeString(input: unknown) {
  let nextId = 0;
  const seen = new WeakMap<object, number>();

  try {
    const result = JSON.stringify(input, function replacer(this: unknown, key, value) {
      // The owner of a vnode holds a large graph with cycles.
      if (key === 'ctx' && isVNode(this)) {
        return undefined;
      }

      if (typeof value === 'bigint') {
        return `__bigint__:${value}`;
      }

      if (value !== null && typeof value === 'object') {
        const id = seen.get(value);
        if (id !== undefined) {
          return `__object__:${id}`;
        }

        seen.set(value, nextId);
        nextId += 1;
      }

      return value;
    });

    return result ?? `__top__:${typeof input}`;
  } catch {
    return '__unserializable__';
  }
}
