import { computed, onBeforeUpdate, shallowRef, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { warn } from '../common/warn';
import { getCallerInstance, readDeclaredProps, readSetKeys } from '../internals/callerProps';

/**
 * The props that `useForwardProps` gives. Vue types an optional Boolean prop as always present.
 * The composable leaves out a Boolean prop that the caller did not set, so its key is optional.
 */
export type ForwardedProps<Props> = {
  [Key in keyof Props as [Props[Key]] extends [boolean] ? Key : never]?: Props[Key];
} & {
  [Key in keyof Props as [Props[Key]] extends [boolean] ? never : Key]: Props[Key];
};

/**
 * Gives the declared props that the caller set, plus the component defaults.
 * Bind the result on a part with `v-bind`. An absent Boolean prop with no default stays absent.
 *
 * @param props The props of the component, as `defineProps` returns them, or a ref or a getter of them.
 * @returns A computed object of the props to forward. A prop with the value `undefined` is absent.
 */
export function useForwardProps<Props extends object>(
  props: MaybeRefOrGetter<Props>,
): ComputedRef<ForwardedProps<Props>> {
  const instance = getCallerInstance();
  if (!instance) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        '`useForwardProps` ran with no virtual DOM component, so it cannot read the props that the caller set.',
        'It forwards each prop that is not `undefined`, so an absent Boolean prop can keep the value `false`.',
        'In a Vapor component, give each optional Boolean prop the default `undefined` and bind `props` without this function.',
        'Elsewhere, call it in the `setup` of a component.',
      );
    }
    return computed(
      () =>
        Object.fromEntries(
          Object.entries(toValue(props)).filter(([, value]) => value !== undefined),
        ) as ForwardedProps<Props>,
    );
  }

  const declared = readDeclaredProps(instance);
  const keysWithDefault = Object.keys(declared).filter(
    (key) => declared[key]?.default !== undefined,
  );

  // No reactive source gives the names that the caller set. An absent Boolean prop and an explicit
  // `false` have the same value, so no prop changes when the caller starts to set the prop.
  const setKeys = shallowRef(readSetKeys(instance));
  onBeforeUpdate(() => {
    const next = readSetKeys(instance);
    if (next.length !== setKeys.value.length || next.some((key, i) => key !== setKeys.value[i])) {
      setKeys.value = next;
    }
  });

  return computed(() => {
    const source = toValue(props) as Record<string, unknown>;
    const forwarded: Record<string, unknown> = {};
    for (const key of new Set([...keysWithDefault, ...setKeys.value])) {
      if (Object.hasOwn(declared, key) && source[key] !== undefined) {
        forwarded[key] = source[key];
      }
    }
    return forwarded as ForwardedProps<Props>;
  });
}
