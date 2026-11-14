import { toValue } from 'vue';
import type { CSSProperties, MaybeRefOrGetter } from 'vue';
import { getDisabledMountTransitionStyles } from '../../../internals/getDisabledMountTransitionStyles';
import { useRenderElement } from '../../../internals/useRenderElement';
import type {
  UseRenderElementComponentProps,
  UseRenderElementParameters,
  UseRenderElementReturnValue,
} from '../../../internals/useRenderElement';
import type { TransitionStatus } from '../../../internals/useTransitionStatus';
import { popupStateMapping } from '../popupStateMapping';

export interface UsePositionerOptions<State> {
  /**
   * The state of the positioner.
   */
  state: MaybeRefOrGetter<State>;
  /**
   * The style of the positioner, such as `positionerStyles` of `useAnchorPositioning`.
   */
  styles: MaybeRefOrGetter<CSSProperties>;
  transitionStatus: MaybeRefOrGetter<TransitionStatus>;
  /**
   * Callbacks that get the element of the positioner.
   */
  ref?: UseRenderElementParameters<State, HTMLDivElement>['ref'];
  /**
   * Whether the positioner has the `hidden` attribute.
   */
  hidden?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the positioner ignores pointer events.
   * @default false
   */
  inert?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Makes the props of the outer positioner element that popups share. It gives the element its
 * role, its hidden state, its style and the state attributes of a popup.
 * Call it in `setup`. The template binds the result of `elementProps()` on the element.
 */
export function usePositioner<State extends Record<string, any>>(
  componentProps: UseRenderElementComponentProps<State>,
  options: UsePositionerOptions<State>,
): UseRenderElementReturnValue<HTMLDivElement> {
  return useRenderElement<State, HTMLDivElement>('div', componentProps, {
    state: options.state,
    ref: options.ref,
    stateAttributesMapping: popupStateMapping,
    props: (attrs) => {
      const style: CSSProperties = { ...toValue(options.styles) };
      if (toValue(options.inert)) {
        style.pointerEvents = 'none';
      }

      return [
        {
          role: 'presentation',
          // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
          hidden: toValue(options.hidden) ? true : undefined,
          style,
        },
        getDisabledMountTransitionStyles(toValue(options.transitionStatus)),
        attrs,
      ];
    },
  });
}
