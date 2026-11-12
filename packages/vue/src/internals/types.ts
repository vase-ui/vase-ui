import type { Component, HTMLAttributes, StyleValue } from 'vue';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../types';

export type { HTMLProps, VaseUIEvent, ComponentRenderFn };

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
 * Adds a `preventVaseUIHandler` method to all event handlers.
 */
export type WithVaseUIEvent<T> = {
  [K in keyof T]: WithPreventVaseUIHandler<T[K]>;
};

/**
 * Props shared by all Vase UI parts that render an element.
 * Contains `as`, `stateClass` and `stateStyle`.
 */
export interface VaseUIComponentProps<State> {
  /**
   * Replaces the element of the part with a different tag or component.
   * To give the element props or children of its own, use the `#render` slot.
   * If the part also has a `#render` slot, the slot wins.
   */
  as?: string | Component | undefined;
  /**
   * Returns a CSS class from the state of the part.
   * The class comes after the `class` attribute.
   */
  stateClass?: ((state: State) => ClassValue) | undefined;
  /**
   * Returns a style from the state of the part.
   * It wins over the `style` attribute.
   */
  stateStyle?: ((state: State) => StyleValue) | undefined;
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

/**
 * The package supports Vue 3.5.0, which does not export `ClassValue`.
 */
export type ClassValue = HTMLAttributes['class'];
