import { computed, toValue } from 'vue';
import type {
  Component,
  ComputedRef,
  IntrinsicElementAttributes,
  MaybeRefOrGetter,
  ShallowRef,
} from 'vue';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';
import type { UseRenderElementParameters } from '../internals/useRenderElement';

/**
 * Gives the API of a Vase UI part to a component.
 * The component gets the `as` prop, the `#render` slot, `stateClass`, `stateStyle`,
 * the state data attributes and the exposed `element`.
 *
 * Call it in `setup`.
 * Set `inheritAttrs: false`. The composable reads the attributes with `useAttrs()`
 * and puts them on the element.
 * Expose `element` with `defineExpose({ element })`.
 * Write these two lines in the template:
 *
 * ```vue
 * <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
 * <component :is="tag" v-else v-bind="elementProps()"><slot :state="state" /></component>
 * ```
 *
 * @param componentProps The reactive props object of the component. Do not destructure it.
 * The composable reads `as`, `stateClass` and `stateStyle` from it.
 * A component with none of the three passes `{}`.
 * @param params The state and the other parameters for the element.
 * @public
 */
export function useRender<
  State extends Record<string, any>,
  RenderedElementType extends Element = HTMLElement,
>(
  componentProps: useRender.ComponentProps<State>,
  params: useRender.Parameters<State, RenderedElementType> = {},
): useRender.ReturnValue<RenderedElementType> {
  const { defaultTagName, ...elementParams } = params;
  const getDefaultTag = () => toValue(defaultTagName) ?? 'div';

  const { element, elementProps } = useRenderElement<State, RenderedElementType>(
    getDefaultTag(),
    componentProps,
    elementParams,
  );
  const tag = computed(() => componentProps.as ?? getDefaultTag());

  return { element, elementProps, tag };
}

/**
 * The type of the `#render` slot. Use it in `defineSlots`.
 */
export type UseRenderRenderProp<State = Record<string, unknown>> = ComponentRenderFn<
  HTMLProps,
  State
>;

/**
 * The native attributes and listeners of a tag.
 * Extend it behind a `@vue-ignore` comment in the props interface of a component.
 * The SFC compiler then makes no prop of them, and they stay in `$attrs`.
 */
export type UseRenderElementProps<TagName extends keyof IntrinsicElementAttributes> =
  WithVaseUIEvent<IntrinsicElementAttributes[TagName]>;

/**
 * The props that a component declares for `useRender`: `as`, `stateClass` and `stateStyle`.
 * The props interface of the component extends it.
 */
export interface UseRenderComponentProps<State = {}> extends VaseUIComponentProps<State> {}

export interface UseRenderParameters<State, RenderedElementType extends Element = HTMLElement> {
  /**
   * The state of the component.
   * It becomes the `data-*` attributes of the element.
   * `stateClass` and `stateStyle` get it as their argument.
   * It takes a value, a ref or a getter.
   */
  state?: MaybeRefOrGetter<State> | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   * @example { isActive: (value) => (value ? { 'data-is-active': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * A function that gets the attributes and listeners of the consumer, without `class` and `style`.
   * It returns the props of the element, or an array of props, in merge order. The rightmost wins.
   * A set can be `undefined`, or a function that gets the props merged so far.
   * The default is the attributes of the consumer.
   * @example (attrs) => [{ role: 'separator' }, attrs]
   */
  props?: UseRenderElementParameters<State, RenderedElementType>['props'];
  /**
   * Callbacks that get the element, and `null` when the element goes away.
   * Give them one time, in `setup`.
   */
  ref?: UseRenderElementParameters<State, RenderedElementType>['ref'];
  /**
   * The tag of the element when the `as` prop is not set.
   * It takes a value, a ref or a getter.
   * A change of the tag does not change the defaults of the first tag:
   * `type="button"` for `button` and `alt=""` for `img`.
   * @default 'div'
   */
  defaultTagName?: MaybeRefOrGetter<string | undefined> | undefined;
}

export interface UseRenderReturnValue<RenderedElementType extends Element = HTMLElement> {
  /**
   * The element of the component, or `null`. The component exposes it: `defineExpose({ element })`.
   */
  element: ShallowRef<RenderedElementType | null>;
  /**
   * Makes the props for the element: the state data attributes, the attributes and listeners,
   * `class`, `style` and `ref`.
   * Call it in the template, not in a `computed`.
   * A `computed` does not see an attribute that comes later.
   */
  elementProps: () => HTMLProps;
  /**
   * The tag or the component that the template renders: the `as` prop, or the default tag.
   */
  tag: ComputedRef<string | Component>;
}

export interface UseRenderState {}

export namespace useRender {
  export type State = UseRenderState;
  export type RenderProp<TState = Record<string, unknown>> = UseRenderRenderProp<TState>;
  export type ElementProps<TagName extends keyof IntrinsicElementAttributes> =
    UseRenderElementProps<TagName>;
  export type ComponentProps<TState = {}> = UseRenderComponentProps<TState>;
  export type Parameters<
    TState,
    RenderedElementType extends Element = HTMLElement,
  > = UseRenderParameters<TState, RenderedElementType>;
  export type ReturnValue<RenderedElementType extends Element = HTMLElement> =
    UseRenderReturnValue<RenderedElementType>;
}
