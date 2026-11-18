import { computed, nextTick, onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { Dimensions } from '@floating-ui/utils';
import { EMPTY_OBJECT } from '../../../common/empty';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import type { Side } from '../../../internals/useAnchorPositioning';
import { useAnimationsFinished } from '../../../internals/useAnimationsFinished';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { useDomEffect } from '../useDomEffect';
import { getCssDimensions } from '../../getCssDimensions';
import * as CommonPositionerCssVars from '../positioning/CommonPositionerCssVars';
import { popupSizeStyles, positionerSizeStyles } from './popupSizeStyles';

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 * Call it in `setup`.
 */
export function usePopupAutoResize(parameters: UsePopupAutoResizeParameters) {
  const { onMeasureLayout, onMeasureLayoutComplete } = parameters;

  const runOnceAnimationsFinish = useAnimationsFinished(
    () => toValue(parameters.popupElement),
    true,
  );

  const animationFrame = useAnimationFrame();

  let committedDimensions: Dimensions | null = null;

  const { isHeld } = useKeepAliveState();
  const ready = shallowRef(false);
  onMounted(() => {
    ready.value = true;
  });

  const anchoringStyles = computed(() =>
    getPopupAnchoringStyles(toValue(parameters.side), toValue(parameters.direction)),
  );
  // An ancestor's deactivation hook reads the detached popup before Vue can patch its style.
  useDomEffect(
    [() => toValue(parameters.popupElement), () => toValue(parameters.mounted), anchoringStyles],
    () => {
      const popup = toValue(parameters.popupElement);
      if (!popup || !toValue(parameters.mounted)) {
        return undefined;
      }
      const anchors = Object.entries(anchoringStyles.value).filter(
        ([key]) => !popup.style.getPropertyValue(key),
      );
      for (const [key, value] of anchors) {
        popup.style.setProperty(key, value);
      }
      return () => {
        for (const [key, value] of anchors) {
          if (popup.style.getPropertyValue(key) === value) {
            popup.style.removeProperty(key);
          }
        }
      };
    },
  );
  const popupSize = shallowRef<Dimensions | 'auto' | null>(null);
  const positionerSize = shallowRef<Dimensions | null>(null);
  const active = computed(() => ready.value && !isHeld.value && toValue(parameters.mounted));
  watch(
    [
      active,
      () => toValue(parameters.popupElement),
      () => toValue(parameters.positionerElement),
      () => toValue(parameters.content),
      anchoringStyles,
    ],
    ([shown, popup, positioner], _, onCleanup) => {
      if (!toValue(parameters.mounted)) {
        committedDimensions = null;
      }
      if (!shown || !popup?.isConnected || !positioner) {
        return;
      }

      // Both boxes must have their intrinsic size in the same layout read.
      const restorePopup = applyElementStyles(popup, {
        ...popupSizeStyles('auto'),
        position: 'static',
        transform: 'none',
        scale: '1',
      });
      const restorePositioner = applyElementStyles(positioner, {
        [CommonPositionerCssVars.availableWidth]: 'max-content',
        [CommonPositionerCssVars.availableHeight]: 'max-content',
        [CommonPositionerCssVars.positionerWidth]: 'max-content',
        [CommonPositionerCssVars.positionerHeight]: 'max-content',
      });
      const previous = committedDimensions;
      let target: Dimensions;
      try {
        onMeasureLayout?.();
        target = getCssDimensions(popup);
      } finally {
        restorePopup();
        restorePositioner();
      }
      onMeasureLayoutComplete?.(previous, target);
      committedDimensions = target;
      positionerSize.value = target;
      popupSize.value = previous ?? 'auto';
      if (!previous) {
        return;
      }

      const controller = new AbortController();
      onCleanup(() => {
        controller.abort();
        animationFrame.cancel();
      });
      animationFrame.request(() => {
        popupSize.value = target;
        void nextTick(() => {
          if (!controller.signal.aborted) {
            runOnceAnimationsFinish(() => {
              popupSize.value = 'auto';
            }, controller.signal);
          }
        });
      });
    },
    { flush: 'post' },
  );

  return {
    popup: computed(() => popupSizeStyles(popupSize.value)),
    positioner: computed(() => positionerSizeStyles(positionerSize.value)),
  };
}

interface UsePopupAutoResizeParameters {
  /**
   * Element to resize.
   */
  popupElement: MaybeRefOrGetter<HTMLElement | null>;
  /*
   * Positioner element (parent of the popup)
   */
  positionerElement: MaybeRefOrGetter<HTMLElement | null>;
  /**
   * Whether the popup is mounted.
   */
  mounted: MaybeRefOrGetter<boolean>;
  /*
   * Content that may change and trigger a resize.
   * This doesn't have to be the actual content of the popup, but a value that triggers a resize.
   */
  content: MaybeRefOrGetter<unknown>;
  /**
   * Callback fired immediately before measuring the dimensions of the new content.
   */
  onMeasureLayout?: (() => void) | undefined;
  /**
   * Callback fired after the new dimensions have been measured.
   *
   * @param previousDimensions Dimensions before the change, or `null` if this is the first measurement.
   * @param newDimensions Newly measured dimensions.
   */
  onMeasureLayoutComplete?:
    ((previousDimensions: Dimensions | null, newDimensions: Dimensions) => void) | undefined;

  side: MaybeRefOrGetter<Side>;
  direction: MaybeRefOrGetter<'ltr' | 'rtl'>;
}

function getPopupAnchoringStyles(side: Side, direction: 'ltr' | 'rtl'): Record<string, string> {
  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  const isPhysicalTop = side === 'top';
  const isPhysicalLeft =
    side === 'left' || side === (direction === 'rtl' ? 'inline-end' : 'inline-start');

  if (!isPhysicalTop && !isPhysicalLeft) {
    return EMPTY_OBJECT;
  }

  return {
    position: 'absolute',
    [isPhysicalTop ? 'bottom' : 'top']: '0px',
    [isPhysicalLeft ? 'right' : 'left']: '0px',
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const { style } = element;
  const previous = Object.entries(styles).map(([key, value]) => {
    const original = [key, style.getPropertyValue(key), style.getPropertyPriority(key)] as const;
    style.setProperty(key, value);
    return original;
  });
  return () => {
    for (const [key, value, priority] of previous) {
      style.setProperty(key, value, priority);
    }
  };
}
