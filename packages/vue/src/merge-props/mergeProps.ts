import { normalizeClass, normalizeStyle } from 'vue';
import type { IntrinsicElementAttributes, NativeElements } from 'vue';
import type { VaseUIEvent, WithVaseUIEvent } from './types';

type ElementType = keyof IntrinsicElementAttributes;
type PropsOf<T extends ElementType> = WithVaseUIEvent<NativeElements[T]>;
type InputProps<T extends ElementType> =
  PropsOf<T> | ((otherProps: PropsOf<T>) => PropsOf<T>) | undefined;
type Handler = (...args: any[]) => unknown;
type HandlerValue = Handler | Handler[] | null | false | undefined;

const EMPTY_PROPS = {};

/**
 * Merges sets of Vue props. The rightmost set wins, as with `Object.assign`: its fields replace
 * the conflicting fields of the sets to its left. Event handlers, `class` and `style` have other
 * rules.
 *
 * Event handlers run from right to left. The rightmost handler runs first, and the leftmost
 * handler runs last. An array of handlers is one handler, and its members run in index order.
 * When the first argument is a DOM event, a handler can call `event.preventVaseUIHandler()`.
 * The handlers to its left then do not run. This does not call `preventDefault()` or
 * `stopPropagation()`. When the first argument is not a DOM event, all handlers run.
 *
 * `class` values are joined, rightmost first. A value can be a string, an array or an object.
 * `style` values are merged, and the rightmost value of each property wins. A value can be a
 * string, an array or an object.
 *
 * A set can be an object or a function. The function gets the props that are merged up to that
 * point, from left to right. For `(obj1, obj2, fn, obj3)`, `fn` gets the merge of `obj1` and
 * `obj2`. The result of the function is not merged, so the function must call the earlier
 * handlers itself.
 *
 * `preventVaseUIHandler()` does not stop a handler that such a function returns. That handler
 * must read `event.vaseUIHandlerPrevented` and stop when it is `true`.
 *
 * @important **`ref` is not merged.** Only the rightmost `ref` is kept.
 * @param a Props object to merge.
 * @param b Props object to merge. Its props replace the conflicting props of `a`.
 * @param c Props object to merge. Its props replace the conflicting props of `a` and `b`.
 * @param d Props object to merge. Its props replace the conflicting props of `a` to `c`.
 * @param e Props object to merge. Its props replace the conflicting props of `a` to `d`.
 * @returns The merged props.
 * @public
 */
export function mergeProps<T extends ElementType>(
  a: InputProps<T>,
  b: InputProps<T>,
  c: InputProps<T>,
  d: InputProps<T>,
  e: InputProps<T>,
): PropsOf<T>;
export function mergeProps<T extends ElementType>(
  a: InputProps<T>,
  b: InputProps<T>,
  c: InputProps<T>,
  d: InputProps<T>,
): PropsOf<T>;
export function mergeProps<T extends ElementType>(
  a: InputProps<T>,
  b: InputProps<T>,
  c: InputProps<T>,
): PropsOf<T>;
export function mergeProps<T extends ElementType>(a: InputProps<T>, b: InputProps<T>): PropsOf<T>;
export function mergeProps(a: any, b: any, c?: any, d?: any, e?: any) {
  if (!c && !d && !e && !a) {
    return createInitialMergedProps(b);
  }

  // `merged` is a copy, because the merge below changes it.
  let merged = createInitialMergedProps(a);

  if (b) {
    merged = mergeInto(merged, b);
  }
  if (c) {
    merged = mergeInto(merged, c);
  }
  if (d) {
    merged = mergeInto(merged, d);
  }
  if (e) {
    merged = mergeInto(merged, e);
  }

  return merged;
}

/**
 * Merges any number of sets of Vue props with the rules of {@link mergeProps}.
 * This function takes an array of props instead of single arguments.
 *
 * It is slower than {@link mergeProps}, because it takes an array instead of a fixed number of
 * arguments. Use {@link mergeProps} for five sets or fewer.
 *
 * @param props Array of props to merge.
 * @returns The merged props.
 * @see mergeProps
 * @public
 */
export function mergePropsN<T extends ElementType>(props: InputProps<T>[]): PropsOf<T> {
  if (props.length === 0) {
    return EMPTY_PROPS as PropsOf<T>;
  }
  if (props.length === 1) {
    return createInitialMergedProps(props[0]) as PropsOf<T>;
  }

  // `merged` is a copy, because the merge below changes it.
  let merged = createInitialMergedProps(props[0]);

  for (let i = 1; i < props.length; i += 1) {
    merged = mergeInto(merged, props[i]);
  }

  return merged as PropsOf<T>;
}

function createInitialMergedProps<T extends ElementType>(inputProps: InputProps<T>) {
  if (isPropsGetter(inputProps)) {
    // The code does not wrap a handler that a props getter returns. Such a handler keeps its rules.
    return { ...inputProps(EMPTY_PROPS as PropsOf<T>) };
  }

  return copyInitialProps(inputProps);
}

function mergeInto<T extends ElementType>(merged: Record<string, any>, inputProps: InputProps<T>) {
  if (isPropsGetter(inputProps)) {
    return inputProps(merged as PropsOf<T>);
  }
  return mutablyMergeInto(merged, inputProps);
}

function copyInitialProps<T extends ElementType>(inputProps: NativeElements[T] | undefined) {
  const copiedProps = { ...inputProps } as Record<string, any>;

  // `copiedProps` is a new object, so `for...in` reads only its own keys.
  for (const propName in copiedProps) {
    const propValue = copiedProps[propName];
    if (isEventHandler(propName, propValue)) {
      copiedProps[propName] = wrapEventHandler(propValue);
    }
  }

  return copiedProps;
}

function mutablyMergeInto<T extends ElementType>(
  mergedProps: Record<string, any>,
  externalProps: NativeElements[T] | undefined,
) {
  if (!externalProps) {
    return mergedProps;
  }

  for (const propName in externalProps) {
    const externalPropValue: any = externalProps[propName];

    switch (propName) {
      case 'style': {
        mergedProps[propName] = mergeStyles(mergedProps.style, externalPropValue);
        break;
      }
      case 'class': {
        mergedProps[propName] = mergeClassNames(mergedProps.class, externalPropValue);
        break;
      }
      default: {
        if (isEventHandler(propName, externalPropValue)) {
          mergedProps[propName] = mergeEventHandlers(mergedProps[propName], externalPropValue);
        } else {
          mergedProps[propName] = externalPropValue;
        }
      }
    }
  }

  return mergedProps;
}

function isEventHandler(key: string, value: unknown) {
  // This approach is more efficient than using a regex.
  const code0 = key.charCodeAt(0);
  const code1 = key.charCodeAt(1);
  const code2 = key.charCodeAt(2);
  return (
    code0 === 111 /* o */ &&
    code1 === 110 /* n */ &&
    code2 >= 65 /* A */ &&
    code2 <= 90 /* Z */ &&
    (typeof value === 'function' || Array.isArray(value) || !value)
  );
}

function isPropsGetter<T extends ElementType>(
  inputProps: InputProps<T>,
): inputProps is (props: PropsOf<T>) => PropsOf<T> {
  return typeof inputProps === 'function';
}

function toHandler(handlers: Handler | Handler[]): Handler {
  if (!Array.isArray(handlers)) {
    return handlers;
  }

  return (...args) => {
    for (const handler of handlers) {
      if (typeof handler === 'function') {
        handler(...args);
      }
    }
  };
}

function mergeEventHandlers(ourHandlers: HandlerValue, theirHandlers: HandlerValue) {
  if (!theirHandlers) {
    return ourHandlers;
  }
  if (!ourHandlers) {
    return wrapEventHandler(theirHandlers);
  }

  const ourHandler = toHandler(ourHandlers);
  const theirHandler = toHandler(theirHandlers);

  return (...args: unknown[]) => {
    const event = args[0];

    if (isEvent(event)) {
      const vaseUIEvent = event as VaseUIEvent<typeof event>;

      makeEventPreventable(vaseUIEvent);

      const result = theirHandler(...args);

      if (!vaseUIEvent.vaseUIHandlerPrevented) {
        ourHandler(...args);
      }

      return result;
    }

    const result = theirHandler(...args);
    ourHandler(...args);
    return result;
  };
}

function wrapEventHandler(handlers: HandlerValue) {
  if (!handlers) {
    return handlers;
  }

  const handler = toHandler(handlers);

  return (...args: unknown[]) => {
    const event = args[0];

    if (isEvent(event)) {
      makeEventPreventable(event as VaseUIEvent<typeof event>);
    }

    return handler(...args);
  };
}

export function makeEventPreventable<T extends Event>(event: VaseUIEvent<T>) {
  event.preventVaseUIHandler = () => {
    (event.vaseUIHandlerPrevented as boolean) = true;
  };

  return event;
}

function mergeStyles(ourStyle: unknown, theirStyle: unknown) {
  if (ourStyle && theirStyle) {
    return normalizeStyle([ourStyle, theirStyle]);
  }

  return ourStyle || theirStyle || undefined;
}

function normalizeClassName(className: unknown) {
  return typeof className === 'string' || className === undefined
    ? className
    : normalizeClass(className);
}

export function mergeClassNames(
  ourClassName: unknown,
  theirClassName: unknown,
): string | undefined {
  const ourClass = normalizeClassName(ourClassName);
  const theirClass = normalizeClassName(theirClassName);

  if (theirClass) {
    if (ourClass) {
      return theirClass + ' ' + ourClass;
    }

    return theirClass;
  }

  return ourClass;
}

// An event from another window has another `Event` class, so this test does not use `instanceof`.
function isEvent(event: unknown): event is Event {
  return event != null && typeof event === 'object' && 'preventDefault' in event;
}
