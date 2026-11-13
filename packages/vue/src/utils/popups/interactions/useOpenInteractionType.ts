import { shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { platform } from '../../../common/platform';
import { useEnhancedClickHandler } from '../../../common/useEnhancedClickHandler';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { useValueChanged } from '../../../internals/useValueChanged';

/**
 * Gives the listeners that tell `setOpenMethod` the type of the input that presses the trigger.
 * They do this only while the popup is closed. Call it in `setup`.
 *
 * @param open The open state of the popup, as a ref or a getter.
 * @param setOpenMethod The function that gets the type of the input.
 */
export function useOpenMethodTriggerProps(
  open: MaybeRefOrGetter<boolean>,
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  return useEnhancedClickHandler((_event, interactionType) => {
    if (!toValue(open)) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
          // will be "" in that case.
          (platform.os.ios ? 'touch' : ''),
      );
    }
  });
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 * Call it in `setup`, and bind `triggerProps` on the trigger.
 *
 * @param open The open state of the component, as a ref or a getter.
 */
export function useOpenInteractionType(open: MaybeRefOrGetter<boolean>): {
  openMethod: Readonly<Ref<InteractionType | null>>;
  triggerProps: ReturnType<typeof useOpenMethodTriggerProps>;
} {
  const openMethod = shallowRef<InteractionType | null>(null);

  const triggerProps = useOpenMethodTriggerProps(open, (interactionType) => {
    openMethod.value = interactionType;
  });

  useValueChanged(open, (previousOpen) => {
    if (previousOpen && !toValue(open)) {
      openMethod.value = null;
    }
  });

  return { openMethod, triggerProps };
}
