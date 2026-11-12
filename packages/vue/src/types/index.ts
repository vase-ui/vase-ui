import type { ComponentPublicInstance, HTMLAttributes, VNode } from 'vue';

export type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../internals/createBaseUIEventDetails';

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
