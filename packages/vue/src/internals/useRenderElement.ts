import {
  callWithAsyncErrorHandling,
  ErrorCodes,
  inject,
  normalizeStyle,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUpdated,
  provide,
  shallowRef,
  toValue,
  useAttrs,
  useSlots,
} from 'vue';
// eslint-disable-next-line no-restricted-imports -- The second focus listener gives an error of a handler to the error handler of the app, as a Vue listener does. Vue needs the instance of the part for that. A Vapor component gets `null`. Vue's listener on an element of a Vapor template skips no event, so there the second listener calls no handler.
import { getCurrentInstance } from 'vue';
import type {
  ComponentPublicInstance,
  CSSProperties,
  InjectionKey,
  MaybeRefOrGetter,
  ShallowRef,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import { EMPTY_OBJECT } from '../common/empty';
import { mergeObjects } from '../common/mergeObjects';
import { warn } from '../common/warn';
import { mergeClassNames, mergeProps, mergePropsN } from '../merge-props';
import { getStateAttributesProps } from './getStateAttributesProps';
import { omitUndefinedAttributes } from './omitUndefinedAttributes';
import type { StateAttributesMapping } from './getStateAttributesProps';
import { resolveElement } from './resolveElement';
import type { HTMLProps, VaseUIComponentProps } from './types';

type RefCallback<E extends Element> = (element: E | null) => void;

type PropsSet =
  Record<string, any> | ((props: Record<string, any>) => Record<string, any>) | undefined;

interface ChildrenMarker {
  mounted: boolean;
}

const CHILDREN_MARKER: InjectionKey<ChildrenMarker> = Symbol();

/**
 * Tells the part that its `children` component is mounted, until that component unmounts.
 * The `children` component of a part calls it in `setup`.
 * Only a warning of a development build reads the mark, so a production build makes no mark.
 */
export function markChildrenMounted(): void {
  if (process.env.NODE_ENV !== 'production') {
    const marker = inject(CHILDREN_MARKER, null);
    if (marker) {
      marker.mounted = true;
      onBeforeUnmount(() => {
        marker.mounted = false;
      });
    }
  }
}

// Vue skips a Vue listener that it attached in the millisecond of an event when an earlier Vue
// listener got the event. `focus` and `blur` do not bubble, and no part has a Vue listener for them
// in the capture phase. The Vue listener of the target thus gets each of them first.
const FOCUS_KEYS = {
  onFocusin: { type: 'focusin', capture: false },
  onFocusout: { type: 'focusout', capture: false },
  onFocusinCapture: { type: 'focusin', capture: true },
  onFocusoutCapture: { type: 'focusout', capture: true },
} as const;

type FocusKey = keyof typeof FOCUS_KEYS;

const FOCUS_KEY_LIST = Object.keys(FOCUS_KEYS) as FocusKey[];

type FocusHandler = (event: FocusEvent) => unknown;

interface FocusListeners {
  // The handler of the last `elementProps()` call, or `undefined` when its props had no such key.
  handler: FocusHandler | undefined;
  // It replaces the handler in the props, and it marks each event that Vue runs.
  readonly vueListener: FocusHandler;
  // It runs the handler for an event that Vue skipped.
  readonly nativeListener: (event: FocusEvent) => void;
  element: Element | null;
  remove: (() => void) | undefined;
}

// A list of fallback values for one property counts, because a client applies each value.
function hasStyleValue(style: Record<string, unknown>): boolean {
  for (const key in style) {
    const value = style[key];
    if (value !== undefined && value !== null && value !== '') {
      return true;
    }
  }
  return false;
}

/**
 * Makes the props of the element of a part. A part calls it in `setup`.
 * The template of the part calls `elementProps()` and binds the result on its element.
 *
 * @param element The default tag of the part, as a value, a ref or a getter.
 * @param componentProps The reactive props object of the part. Do not destructure it.
 * The composable reads `as`, `stateClass` and `stateStyle`.
 * @param params Other parameters for the element.
 */
export function useRenderElement<
  State extends Record<string, any>,
  RenderedElementType extends Element = HTMLElement,
>(
  element: MaybeRefOrGetter<string>,
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State, RenderedElementType> = {},
): UseRenderElementReturnValue<RenderedElementType> {
  const attrs = useAttrs();
  const slots = useSlots();
  const elementRef: ShallowRef<RenderedElementType | null> = shallowRef(null);
  const refCallbacks = Array.isArray(params.ref) ? params.ref : [params.ref];
  let hasCalledElementProps = false;
  let hasWrittenStyleKey = false;

  // Vue gives the setter an element, a component or `null`. The part keeps that value and
  // resolves it again after each render.
  let target: Element | ComponentPublicInstance | null = null;
  // A read of `elementRef` in the setter would make the render of the part depend on it, because
  // Vue calls the setter during that render.
  let heldElement: RenderedElementType | null = null;

  const instance = getCurrentInstance();
  const focusListeners = new Map<FocusKey, FocusListeners>();

  function createFocusListeners(): FocusListeners {
    const ran = new WeakSet<Event>();
    const listeners: FocusListeners = {
      handler: undefined,
      vueListener(event) {
        // The mark comes first, so a handler that throws does not run again.
        ran.add(event);
        return listeners.handler?.(event);
      },
      nativeListener(event) {
        if (listeners.handler && !ran.has(event)) {
          callWithAsyncErrorHandling(listeners.handler, instance, ErrorCodes.NATIVE_EVENT_HANDLER, [
            event,
          ]);
        }
      },
      element: null,
      remove: undefined,
    };
    return listeners;
  }

  // Vue adds the listeners of the props during the patch, before it calls the function ref. The
  // native listener thus runs after the Vue listener of its element and phase, and the mark tells
  // it whether Vue ran the handler.
  function syncFocusListeners(element: Element | null) {
    for (const [key, listeners] of focusListeners) {
      const listenerElement = listeners.handler ? element : null;
      if (listenerElement === listeners.element) {
        continue;
      }
      listeners.remove?.();
      const { type, capture } = FOCUS_KEYS[key];
      listeners.remove = listenerElement
        ? addEventListener(listenerElement, type, listeners.nativeListener, capture)
        : undefined;
      listeners.element = listenerElement;
    }
  }

  function update() {
    const resolved = resolveElement(target) as RenderedElementType | null;
    // A render can add or remove a focus key and keep the element.
    syncFocusListeners(resolved);
    // Vue calls a function ref again on each patch, with the same value.
    if (resolved === heldElement) {
      return;
    }
    heldElement = resolved;
    elementRef.value = resolved;
    for (const callback of refCallbacks) {
      callback?.(resolved);
    }
  }

  function setRef(value: Element | ComponentPublicInstance | null) {
    target = value;
    update();
  }

  function elementProps(): HTMLProps {
    hasCalledElementProps = true;

    const defaultTag = toValue(element);
    const state = toValue(params.state) ?? (EMPTY_OBJECT as State);
    const {
      class: classAttribute,
      style: styleAttribute,
      ...consumerAttrs
    } = omitUndefinedAttributes(attrs);

    const stateProps = getStateAttributesProps(state, params.stateAttributesMapping);

    let resolvedProps: Record<string, any>;
    if (params.props) {
      const sets = params.props(consumerAttrs);
      resolvedProps = Array.isArray(sets) ? mergePropsN(sets) : mergeProps(undefined, sets);
    } else {
      // The call with `undefined` makes the handlers of the set preventable.
      resolvedProps = mergeProps(undefined, consumerAttrs);
    }

    // The result is always a new object, so the writes below do not change a shared object.
    const outProps: Record<string, any> = mergeObjects(stateProps, resolvedProps) ?? {};

    for (const key of FOCUS_KEY_LIST) {
      const handler: unknown = outProps[key];
      let listeners = focusListeners.get(key);
      if (typeof handler === 'function') {
        if (!listeners) {
          listeners = createFocusListeners();
          focusListeners.set(key, listeners);
        }
        listeners.handler = handler as FocusHandler;
        outProps[key] = listeners.vueListener;
      } else if (listeners) {
        listeners.handler = undefined;
      }
    }

    outProps.ref = setRef;

    const consumerClass = mergeClassNames(componentProps.stateClass?.(state), classAttribute);
    if (consumerClass) {
      outProps.class = mergeClassNames(outProps.class, consumerClass);
    }

    // A style can be a string or an array in Vue, so `mergeObjects` does not fit here.
    const style = normalizeStyle([
      outProps.style,
      styleAttribute,
      componentProps.stateStyle?.(state),
      params.overridingStyle?.(),
    ]) as Record<string, unknown>;
    // On a server, Vue writes `style=""` for a `style` key that has no value. On a client, Vue
    // removes the whole `style` attribute when the key goes away. That also removes each
    // declaration that a part writes to the DOM, so the key stays after a render that wrote it.
    if (hasWrittenStyleKey || hasStyleValue(style)) {
      outProps.style = style;
      hasWrittenStyleKey = true;
    } else {
      delete outProps.style;
    }

    if (!slots.render && (componentProps.as === undefined || componentProps.as === defaultTag)) {
      if (defaultTag === 'button' && !('type' in outProps)) {
        outProps.type = 'button';
      }
      if (defaultTag === 'img' && !('alt' in outProps)) {
        outProps.alt = '';
      }
    }

    return outProps as HTMLProps;
  }

  // A target component can set its exposed `element` after its render, also in its own `onMounted`.
  // Vue runs that hook before the `onMounted` or `onUpdated` hook of the part. The callbacks thus
  // get that element, and never the root element of such a target.
  onMounted(update);
  onUpdated(update);

  if (process.env.NODE_ENV !== 'production') {
    let slotWasRendered = false;
    const childrenMarker: ChildrenMarker = { mounted: false };
    if (params.children) {
      provide(CHILDREN_MARKER, childrenMarker);
    }

    // A consumer can give `as` or `#render` after the mount, so the check runs after each render.
    // `warn` writes each message only one time.
    const checkAsWithRenderSlot = () => {
      if (
        slots.render &&
        componentProps.as !== undefined &&
        componentProps.as !== toValue(element)
      ) {
        warn(
          'The `as` prop and the `#render` slot are both set.',
          'The `#render` slot wins, so `as` has no effect.',
          'Remove one of them.',
        );
      }
    };

    // A part can render its `#render` slot for the first time after the mount.
    // The checks thus run after each render in which the slot appears.
    const checkRenderSlot = () => {
      const slotIsRendered = hasCalledElementProps && slots.render !== undefined;
      const slotAppeared = slotIsRendered && !slotWasRendered;
      slotWasRendered = slotIsRendered;

      if (!slotAppeared) {
        return;
      }

      // A component in the slot can expose its element after this check, so the check reads the
      // value that the setter got. `null` means that no element and no component reached the part.
      if (target === null) {
        warn(
          'The `#render` slot gave no element to the part.',
          'The part cannot find its element, so the behavior that needs the element does not work.',
          'Bind `props` on the element: `v-bind="props"`.',
          'In a Vapor component, also bind the `ref` setter by name: `:ref="props.ref"`.',
          'If the element has a `ref` of its own, call `props.ref` in it.',
        );
      }

      if (params.children && !childrenMarker.mounted) {
        warn(
          'The `#render` slot did not mount `children`.',
          'The element then lacks the nodes that the part adds through `children`.',
          'Mount it in the element: `<component :is="children">`.',
        );
      }
    };

    const checkRender = () => {
      checkAsWithRenderSlot();
      checkRenderSlot();
    };

    onBeforeUpdate(() => {
      hasCalledElementProps = false;
    });
    onMounted(checkRender);
    onUpdated(checkRender);
  }

  return { element: elementRef, elementProps };
}

export type UseRenderElementParameters<State, RenderedElementType extends Element = HTMLElement> = {
  /**
   * The state of the part. The default is an empty object.
   */
  state?: MaybeRefOrGetter<State> | undefined;
  /**
   * A function that gets the attributes and listeners of the consumer, without `class`, `style`
   * and each attribute whose value is `undefined`.
   * It returns the props of the part, or an array of props, in merge order. The rightmost wins.
   * A set can be `undefined`, or a function that gets the props merged so far.
   * The default is the attributes of the consumer.
   * @example (attrs) => [{ role: 'separator' }, attrs]
   */
  props?: ((attrs: Record<string, any>) => PropsSet | PropsSet[]) | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Callbacks that get the element of the part, and `null` when the element goes away.
   * Give them one time, in `setup`.
   */
  ref?:
    RefCallback<RenderedElementType> | (RefCallback<RenderedElementType> | undefined)[] | undefined;
  /**
   * Set it to `true` for a part whose `#render` slot has the `children` prop.
   * The part then warns when the slot does not mount `children`.
   */
  children?: boolean | undefined;
  /**
   * A function that returns a style of the part that wins over the `style` attribute and
   * `stateStyle`. The composable merges it last. `undefined` or an empty object adds no style.
   */
  overridingStyle?: (() => CSSProperties | undefined) | undefined;
};

export type UseRenderElementComponentProps<State> = VaseUIComponentProps<State>;

export interface UseRenderElementReturnValue<RenderedElementType extends Element = HTMLElement> {
  /**
   * The element of the part, or `null`. The part exposes it: `defineExpose({ element })`.
   */
  element: ShallowRef<RenderedElementType | null>;
  /**
   * Makes the props for the element: the state data attributes, the attributes and listeners,
   * `class`, `style` and `ref`. The template calls it on each render.
   */
  elementProps: () => HTMLProps;
}
