import { computed, isVNode, shallowRef, watch } from 'vue';
import type { WritableComputedRef } from 'vue';
import { error } from './error';

export interface UseControlledProps<T = unknown> {
  /**
   * Gives the component value when it is controlled.
   */
  controlled: () => T | undefined;
  /**
   * Gives the initial value when the parent omits the prop.
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

export function useControlled<T = unknown>(
  props: Omit<UseControlledProps<T>, 'default'> & { default: () => T },
): WritableComputedRef<T>;
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): WritableComputedRef<T | undefined>;
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): WritableComputedRef<T | undefined> {
  // Calling shallowRef with a ref as the default would reuse the caller's ref for local writes.
  const local = shallowRef<T>();
  local.value = useControlledDefault(props);
  const parent = computed(props.controlled);
  // A sync listener can read and write the model before a watcher of the release runs.
  // Save the parent's value while it still owns the prop.
  watch(
    parent,
    (value) => {
      if (value !== undefined) {
        local.value = value;
      }
    },
    { flush: 'sync', immediate: true },
  );

  return computed({
    get() {
      const value = parent.value;
      return value === undefined ? local.value : value;
    },
    set(value) {
      if (parent.value === undefined) {
        local.value = value;
      }
    },
  });
}

export function useControlledDefault<T>({
  controlled,
  default: getDefault,
  name,
  state = 'value',
}: UseControlledProps<T>) {
  const initial = getDefault();
  if (process.env.NODE_ENV !== 'production') {
    watch(getDefault, (next) => {
      if (
        controlled() === undefined &&
        serializeToDevModeString(initial) !== serializeToDevModeString(next)
      ) {
        error(
          `A component is changing the default ${state} state of an uncontrolled ${name} after being initialized. ` +
            `To suppress this warning opt to use a controlled ${name}.`,
        );
      }
    });
  }
  return initial;
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
