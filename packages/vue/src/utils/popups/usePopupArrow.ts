import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type {
  Align,
  Side,
  UseAnchorPositioningReturnValue,
} from '../../internals/useAnchorPositioning';
import type { VaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupStateMapping } from './popupStateMapping';

interface PopupArrowState {
  open: boolean;
  side: Side;
  align: Align;
  uncentered: boolean;
}

export function usePopupArrow(
  props: VaseUIComponentProps<PopupArrowState>,
  open: MaybeRefOrGetter<boolean>,
  positioner: Pick<
    UseAnchorPositioningReturnValue,
    'side' | 'align' | 'createArrowRef' | 'arrowUncentered' | 'arrowStyles'
  >,
) {
  const state = computed(() => ({
    open: toValue(open),
    side: positioner.side.value,
    align: positioner.align.value,
    uncentered: positioner.arrowUncentered.value,
  }));
  return {
    state,
    ...useRenderElement('div', props, {
      state,
      ref: positioner.createArrowRef(),
      stateAttributesMapping: popupStateMapping,
      props: (attrs) => [{ style: positioner.arrowStyles.value, 'aria-hidden': true }, attrs],
    }),
  };
}
