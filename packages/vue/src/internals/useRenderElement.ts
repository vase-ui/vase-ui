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
  watch,
} from 'vue';
// eslint-disable-next-line no-restricted-imports -- The second focus listener gives an error of a handler to the error handler of the app, as a Vue listener does. Vue needs the instance of the part for that. A Vapor component gets `null`. Vue's listener on an element of a Vapor template skips no event, so there the second listener calls no handler.
import { getCurrentInstance } from 'vue';
import type { ComponentPublicInstance, InjectionKey, MaybeRefOrGetter, ShallowRef } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { EMPTY_OBJECT } from '../common/empty';
import { getServerElement } from '../common/hydration';
import { mergeObjects } from '../common/mergeObjects';
import { warn } from '../common/warn';
import { mergeClassNames, mergeProps, mergePropsN } from '../merge-props';
import { getStateAttributesProps } from './getStateAttributesProps';
import type { StateAttributesMapping } from './getStateAttributesProps';
import { givenAttributes } from './givenAttributes';
import { resolveElement } from './resolveElement';
import type { ButtonBehavior } from './use-button/useButton';
import type { HTMLProps, VaseUIComponentProps, VaseUIEvent } from './types';

type RefCallback<E extends Element> = (element: E | null) => void;

type PropsSet =
  Record<string, any> | ((props: Record<string, any>) => Record<string, any>) | undefined;

const SET_CHILDREN_MOUNTED: InjectionKey<(mounted: boolean) => void> = Symbol();

/**
 * Tells the part that its `children` component is mounted, until that component unmounts.
 * The `children` component of a part calls it in `setup`.
 * Only a warning of a development build reads the mark, so a production build makes no mark.
 */
export function markChildrenMounted(): void {
  if (process.env.NODE_ENV !== 'production') {
    const setMounted = inject(SET_CHILDREN_MOUNTED, null);
    if (setMounted) {
      setMounted(true);
      onBeforeUnmount(() => setMounted(false));
    }
  }
}

// Vue skips a Vue listener that it attached in the millisecond of an event when an earlier Vue
// listener got the event. A part or the consumer can move the focus to a new element in that
// millisecond. `focus` and `blur` do not bubble, and no part has a Vue listener for them in the
// capture phase. The Vue listener of the target thus gets each of them first.
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

// While Vue hydrates an element, it writes no attribute that a `v-bind` object gives. It compares
// only the attributes of its lists of known attributes, and these names are not in those lists.
// `aria-hidden` is not here: the lock of a modal popup writes it to the elements outside the popup,
// and a part can hydrate after that.
function isUncomparedAttribute(name: string): boolean {
  return (
    name === 'role' ||
    name === 'abbr' ||
    name.startsWith('data-') ||
    (name.startsWith('aria-') && name !== 'aria-hidden')
  );
}

// Gives each such attribute of the props the value of the server element when the two differ. The
// render after the mount has the client value again, and Vue then writes or removes each attribute
// that changed. It returns `true` when a value differs.
function takeServerAttributes(
  props: Record<string, any>,
  state: Record<string, any>,
  mapping: StateAttributesMapping<any> | undefined,
  serverElement: Element,
): boolean {
  // The default mapping gives no key for a state that is `false`, and Vue removes an attribute only
  // when the earlier render has its key. A `data-*` attribute that is no state of the part can
  // come from another source, such as a browser extension, so it gets no key.
  for (const key in state) {
    const name = `data-${key.toLowerCase()}`;
    if (
      !(name in props) &&
      !(mapping && Object.hasOwn(mapping, key)) &&
      serverElement.hasAttribute(name)
    ) {
      props[name] = undefined;
    }
  }

  let differs = false;
  for (const name in props) {
    if (!isUncomparedAttribute(name)) {
      continue;
    }
    const value: unknown = props[name];
    // A server and a browser write a string, a number or a Boolean as the same text. The step does
    // not compare another value.
    if (
      value != null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      continue;
    }
    const serverValue = serverElement.getAttribute(name);
    if (serverValue !== (value == null ? null : String(value))) {
      props[name] = serverValue ?? undefined;
      differs = true;
    }
  }
  return differs;
}

/**
 * Makes the props of the element of a part. A part calls it in `setup`.
 * The template of the part calls `usesRenderSlot()` as the last condition of the `v-if` of its
 * `#render` slot.
 * It calls `elementProps()` and binds the result on its element.
 * It also binds `setRef` by name on that element.
 *
 * @param element The default tag of the part, as a value, a ref or a getter.
 * @param componentProps The reactive props object of the part. Do not destructure it.
 * The composable reads `as`.
 * @param params Other parameters for the element.
 */
export function useRenderElement<
  State extends Record<string, any>,
  RenderedElementType extends Element = HTMLElement,
>(
  element: MaybeRefOrGetter<string>,
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State, RenderedElementType> & {
    /** An element ref that another composable needs during setup. */
    elementRef?: ShallowRef<RenderedElementType | null>;
    /** Supplies button actions for the final element and its render slot. */
    button?: (element: ShallowRef<NoInfer<RenderedElementType> | null>) => ButtonBehavior;
  } = {},
): UseRenderElementReturnValue<RenderedElementType> {
  const attrs = useAttrs();
  const slots = useSlots();
  const elementRef: ShallowRef<RenderedElementType | null> = params.elementRef ?? shallowRef(null);
  const button = params.button?.(elementRef);
  const callbacks = params.ref;
  let hasRendered = false;
  let setRefWasCalled = false;
  let hasWrittenStyleKey = false;

  // Vue gives the setter an element, a component or `null`. The part keeps that value and
  // resolves it again after each render.
  let target: Element | ComponentPublicInstance | null = null;
  // A read of `elementRef` in the setter would make the render of the part depend on it, because
  // Vue calls the setter during that render.
  let heldElement: RenderedElementType | null = null;

  const instance = getCurrentInstance();
  // The element of the server HTML while Vue hydrates the part. It is `null` on a server, in a
  // client-only mount, after the mount and with `serverAttributes: false`.
  let serverElement = params.serverAttributes === false ? null : getServerElement();
  const mounted = shallowRef(false);
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
    if (Array.isArray(callbacks)) {
      for (const callback of callbacks) {
        callback?.(resolved);
      }
    } else {
      callbacks?.(resolved);
    }
  }

  function setRef(value: Element | ComponentPublicInstance | null) {
    if (process.env.NODE_ENV !== 'production') {
      setRefWasCalled = true;
    }
    target = value;
    update();
  }

  function elementProps(): HTMLProps {
    hasRendered = true;

    const defaultTag = toValue(element);
    const state = toValue(params.state) ?? (EMPTY_OBJECT as State);
    const {
      class: classAttribute,
      style: styleAttribute,
      ...consumerAttrs
    } = givenAttributes(attrs);

    const stateProps = getStateAttributesProps(state, params.stateAttributesMapping);

    let resolvedProps: Record<string, any>;
    if (params.props) {
      const sets = params.props(consumerAttrs);
      resolvedProps = Array.isArray(sets) ? mergePropsN(sets) : mergeProps(undefined, sets);
    } else {
      // The call with `undefined` makes the handlers of the set preventable.
      resolvedProps = mergeProps(undefined, consumerAttrs);
    }

    if (button) {
      const { onClick, onPointerdown, onMousedown, onKeydown, onKeyup } = resolvedProps;
      resolvedProps = {
        ...button.attributes.value,
        ...resolvedProps,
        onClick: (event: VaseUIEvent<MouseEvent>) => button.press(event, onClick || undefined),
        onPointerdown: (event: VaseUIEvent<PointerEvent>) =>
          button.press(event, onPointerdown || undefined),
        onMousedown: (event: VaseUIEvent<MouseEvent>) =>
          button.mouseDown(event, onMousedown || undefined),
        onKeydown: (event: VaseUIEvent<KeyboardEvent>) =>
          button.keyDown(event, onKeydown || undefined),
        onKeyup: (event: VaseUIEvent<KeyboardEvent>) => button.keyUp(event, onKeyup || undefined),
      };
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

    // The `#render` slot gives the setter to the consumer through props. The part binds the same
    // setter by name, so Vue merges the two into one `ref`.
    outProps.ref = setRef;

    const consumerClass = mergeClassNames(undefined, classAttribute);
    if (consumerClass) {
      outProps.class = mergeClassNames(outProps.class, consumerClass);
    }

    // A style can be a string or an array in Vue, so `mergeObjects` does not fit here.
    const style = normalizeStyle([outProps.style, styleAttribute]) as Record<string, unknown>;
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

    if (
      serverElement &&
      takeServerAttributes(outProps, state, params.stateAttributesMapping, serverElement)
    ) {
      // Only a render that took a value of the server reads `mounted`. Thus only a part whose
      // values differ from the server HTML renders again after the mount.
      toValue(mounted);
    }

    return outProps as HTMLProps;
  }

  // A target component can set its exposed `element` after its render, also in its own `onMounted`.
  // Vue runs that hook before the `onMounted` or `onUpdated` hook of the part. The callbacks thus
  // get that element, and never the root element of such a target.
  onMounted(update);
  onUpdated(update);
  if (serverElement) {
    onMounted(() => {
      serverElement = null;
      mounted.value = true;
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    let slotWasRendered = false;
    let childrenMounted = false;
    if (params.children) {
      provide(SET_CHILDREN_MOUNTED, (mounted) => {
        childrenMounted = mounted;
      });
    }

    // A consumer can give `as` or `#render` after the mount, so the check runs after each render
    // and in the watcher below. `warn` writes each message only one time.
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
      const slotIsRendered = hasRendered && slots.render !== undefined;
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

      if (params.children && !childrenMounted) {
        warn(
          'The `#render` slot did not mount `children`.',
          'The element then lacks the nodes that the part adds through `children`.',
          'Mount it in the element: `<component :is="children">`.',
        );
      }
    };

    // A Vapor component gets no instance from `getCurrentInstance`. A virtual DOM component gets
    // its ref from the spread. A component used as the tag can give its ref after the mount.
    const checkRefBinding = () => {
      if (
        hasRendered &&
        slots.render === undefined &&
        !setRefWasCalled &&
        typeof (componentProps.as ?? toValue(element)) === 'string'
      ) {
        warn(
          'A Vapor component rendered its element with `elementProps()` and bound no `ref` by name.',
          'Vapor mode ignores the `ref` key of a bound object, so `useRender` gets no element.',
          'Bind the setter beside the spread: `v-bind="elementProps()" :ref="setRef"`.',
        );
      }
    };

    const checkRender = () => {
      checkAsWithRenderSlot();
      checkRenderSlot();
      if (params.refBindingCheck && instance === null) {
        checkRefBinding();
      }
    };

    onBeforeUpdate(() => {
      hasRendered = false;
    });
    onMounted(checkRender);
    onUpdated(checkRender);
    // A part compiled as a Vapor component does not update when `as` changes while it renders
    // the `#render` slot. Only the slot reads the props of the element then.
    watch(
      () => componentProps.as !== undefined && componentProps.as !== toValue(element),
      checkAsWithRenderSlot,
      { flush: 'post' },
    );
  }

  function usesRenderSlot(): boolean {
    if (slots.render === undefined) {
      return false;
    }
    if (process.env.NODE_ENV !== 'production') {
      // A slot of a Vapor component reads a slot prop only when the slot uses that prop.
      // A slot that uses no prop thus never calls `elementProps()`.
      hasRendered = true;
    }
    return true;
  }

  return { element: elementRef, elementProps, setRef, usesRenderSlot };
}

export type UseRenderElementParameters<State, RenderedElementType extends Element = HTMLElement> = {
  /**
   * The state of the part. The default is an empty object.
   */
  state?: MaybeRefOrGetter<State> | undefined;
  /**
   * A function that gets the attributes and listeners of the consumer, without `class`, `style`
   * and each attribute that `givenAttributes` leaves out.
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
   * With `false`, `elementProps` gives no value of the server HTML while Vue hydrates the part.
   * `useRender` passes `false`, because the template of a consumer can start with another element.
   */
  serverAttributes?: boolean | undefined;
  /**
   * With `true`, a development build warns when a Vapor component renders a string tag with
   * `elementProps()` and its setter receives no call.
   * `useRender` passes `true` because no lint rule checks the template of a consumer.
   */
  refBindingCheck?: boolean | undefined;
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
   * In a render before the mount of a part that Vue hydrates, a `role`, `abbr`, `data-*` or
   * `aria-*` key (except `aria-hidden`) whose value differs from the server HTML has the server
   * value: a string, or `undefined` when the server element has no such attribute.
   */
  elementProps: () => HTMLProps;
  /**
   * The setter of the element. The template binds it by name on the element, beside the spread.
   * Vapor mode applies only a ref that the template binds by name.
   */
  setRef: (value: Element | ComponentPublicInstance | null) => void;
  /**
   * Tells whether the consumer gave the `#render` slot.
   * The template calls it as the last condition of the `v-if` of that slot:
   * `v-if="usesRenderSlot()"`.
   * In a development build, a `true` result also tells the checks that the part renders the slot.
   */
  usesRenderSlot: () => boolean;
}
