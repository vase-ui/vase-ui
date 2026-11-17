import { camelize, computed, toHandlerKey } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { warn } from '../common/warn';
import { getCallerInstance, readDeclaredEvents } from '../internals/callerProps';
import { useForwardProps } from './useForwardProps';
import type { ForwardedProps } from './useForwardProps';

/**
 * Gives the props of `useForwardProps` and one listener for each event that the wrapper declares.
 * Each listener calls `emit` before it returns, so a caller can cancel a state change.
 * The return type describes the props. It has no listener keys.
 *
 * @param props The props of the wrapper, or a ref or a getter of them.
 * @param emit The function that `defineEmits` returns. Without it, the result has only props.
 * @returns A computed object to bind on the part with `v-bind`.
 */
export function useForwardPropsEmits<Props extends object>(
  props: MaybeRefOrGetter<Props>,
  emit?: (event: never, ...args: never[]) => void,
): ComputedRef<ForwardedProps<Props>> {
  const forwarded = useForwardProps(props);
  if (!emit) {
    return forwarded;
  }
  const instance = getCallerInstance();
  if (!instance) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        '`useForwardPropsEmits` ran with no virtual DOM component, so it cannot read the events that the wrapper declares.',
        'It forwards no event.',
        'In a Vapor component, leave the events undeclared and pass `$attrs` to the part.',
        'Elsewhere, call it in the `setup` of a component.',
      );
    }
    return forwarded;
  }
  const events = readDeclaredEvents(instance);
  if (process.env.NODE_ENV !== 'production' && events.length === 0) {
    warn(
      '`useForwardPropsEmits` received `emit`, but the wrapper declares no event.',
      'It has no event to forward.',
      'Declare the events with `defineEmits`, or use `useForwardProps`.',
    );
  }
  // The event names come from Vue at run time. An emit with overloads accepts only its own names.
  const forwardEvent = emit as (event: string, ...args: unknown[]) => void;
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  for (const event of events) {
    listeners[toHandlerKey(camelize(event))] = (...args) => forwardEvent(event, ...args);
  }
  return computed(() => ({ ...forwarded.value, ...listeners }));
}
