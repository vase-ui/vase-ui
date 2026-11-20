import type { Component, ComponentPublicInstance, HTMLAttributes, VNode } from 'vue';

/**
 * The attributes and listeners that a part gives to its element, and the `ref` setter of the part.
 */
export type HTMLProps = HTMLAttributes & {
  ref: (element: Element | ComponentPublicInstance | null) => void;
};

/**
 * Shape of the `#render` slot: a function that gets the props to bind on the element and the state
 * of the part, and returns the element.
 *
 * @template Props Props to bind on the rendered element.
 * @template State State of the part.
 */
export type ComponentRenderFn<Props, State> = (slotProps: {
  props: Props;
  state: State;
}) => VNode | VNode[];

export type VaseUIEvent<E extends Event> = E & {
  preventVaseUIHandler: () => void;
  readonly vaseUIHandlerPrevented?: boolean | undefined;
};

export type MaybeVaseUIEvent<E extends Event> = E &
  Partial<Pick<VaseUIEvent<E>, 'preventVaseUIHandler' | 'vaseUIHandlerPrevented'>>;

export interface FloatingUIOpenChangeDetails {
  open: boolean;
  reason: string;
  nativeEvent: Event;
  nested: boolean;
  triggerElement?: Element | undefined;
}

type WithPreventVaseUIHandler<T> = T extends (event: infer E) => any
  ? E extends Event
    ? (event: VaseUIEvent<E>) => ReturnType<T>
    : T
  : T extends undefined
    ? undefined
    : T;

/**
 * WAI-ARIA 1.3 defines `aria-description` for each element. The types of Vue do not list it.
 */
interface AriaDescriptionAttribute<Value> {
  /**
   * Defines a string value that describes or annotates the current element.
   * @see aria-describedby
   */
  'aria-description'?: Value | undefined;
}

/**
 * Adds a `preventVaseUIHandler` method to all event handlers.
 * The type omits the key `as`. A part declares `as` itself, and a library can add `as` to the
 * attributes of each element.
 * The type adds the attribute `aria-description`.
 * The type adds `null` to each attribute: `null` removes the value of the part.
 * `PropKeys` names each attribute that reaches a declared prop, such as `aria-label` for the prop
 * `ariaLabel`. Vue gives such a value to the prop, so the attribute keeps the type of Vue.
 */
export type WithVaseUIEvent<T, PropKeys extends keyof T = never> = {
  [K in keyof T as K extends 'as' ? never : K]: K extends `on${Capitalize<string>}`
    ? WithPreventVaseUIHandler<T[K]>
    : K extends PropKeys
      ? T[K]
      : T[K] | null;
} & AriaDescriptionAttribute<string | null>;

/**
 * `WithVaseUIEvent` with the attribute types of Vue, which have no `null`.
 * The sets of `mergeProps` use it. `mergeProps` copies a `null` value to its result, and the type
 * of the result is the type of Vue. `UseRenderElementProps` uses it too, so an object of that type
 * is a set of `mergeProps`.
 */
export type WithVaseUIEventHandlers<T> = {
  [K in keyof T as K extends 'as' ? never : K]: WithPreventVaseUIHandler<T[K]>;
} & AriaDescriptionAttribute<string>;

/**
 * vue-tsc types a generic SFC as a function of its props and its context. `Component` refuses that
 * function when the SFC has a required slot. At run time the SFC is a component object.
 * `@vue-ignore` hides the function type from the SFC compiler. Without it, the compiler gives `as`
 * the run-time type `[String, Function]`. The build of the package keeps that type but not
 * `skipCheck`, so Vue warns for a component object in the development build of a consumer.
 */
export type GenericComponent = /* @vue-ignore */ (props: any, ...args: any[]) => unknown;

/**
 * Props shared by all Vase UI parts that render an element.
 */
export interface VaseUIComponentProps<_State> {
  /**
   * Replaces the element of the part with a different tag or component.
   * To give the element props or children of its own, use the `#render` slot.
   * If the part also has a `#render` slot, the slot wins.
   */
  as?: string | Component | GenericComponent | undefined;
}

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when it is replaced
   * with the `as` prop or the `#render` slot.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export interface NonNativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when it is replaced
   * with the `as` prop or the `#render` slot.
   * Set to `true` if the rendered element is a native button.
   * @default false
   */
  nativeButton?: boolean | undefined;
}

/**
 * Simplifies the display of a type (without modifying it).
 * Taken from https://effectivetypescript.com/2022/02/25/gentips-4-display/
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- `Function` also matches a class, and a class stays as it is.
export type Simplify<T> = T extends Function ? T : { [K in keyof T]: T[K] };

/**
 * Makes specified keys in a type required.
 *
 * @template T - The original type.
 * @template K - The keys to make required.
 */
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;

export type Orientation = 'horizontal' | 'vertical';
