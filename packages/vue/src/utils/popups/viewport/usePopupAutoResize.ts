import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { Dimensions } from '@floating-ui/utils';
import { EMPTY_OBJECT, NOOP } from '../../../common/empty';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import type { Side } from '../../../internals/useAnchorPositioning';
import { useAnimationsFinished } from '../../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../getCssDimensions';
import * as CommonPositionerCssVars from '../positioning/CommonPositionerCssVars';
import * as CommonPopupCssVars from './CommonPopupCssVars';

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

  const anchoringStyles = computed(() =>
    getPopupAnchoringStyles(toValue(parameters.side), toValue(parameters.direction)),
  );

  function measure(): (() => void) | undefined {
    const popupElement = toValue(parameters.popupElement);
    const positionerElement = toValue(parameters.positionerElement);

    // Reset the state when the popup is closed.
    if (!toValue(parameters.mounted)) {
      committedDimensions = null;
      return undefined;
    }

    if (!popupElement || !positionerElement) {
      return undefined;
    }

    const restoreAnchoringStyles = applyElementStyles(popupElement, anchoringStyles.value);

    // Measure the rendered size to enable transitions:
    setPopupCssSize(popupElement, 'auto');

    const restorePopupPosition = overrideElementStyle(popupElement, 'position', 'static');
    const restorePopupTransform = overrideElementStyle(popupElement, 'transform', 'none');
    const restorePopupScale = overrideElementStyle(popupElement, 'scale', '1');
    const restorePositionerAvailableSize = applyElementStyles(positionerElement, {
      [CommonPositionerCssVars.availableWidth]: 'max-content',
      [CommonPositionerCssVars.availableHeight]: 'max-content',
    });

    function restoreMeasurementOverrides() {
      restorePopupPosition();
      restorePopupTransform();
      restorePositionerAvailableSize();
      restorePopupScale();
    }

    onMeasureLayout?.();

    // Initial render (for each time the popup opens).
    if (committedDimensions === null) {
      setPositionerCssSize(positionerElement, 'max-content');

      const dimensions = getCssDimensions(popupElement);

      committedDimensions = dimensions;

      setPositionerCssSize(positionerElement, dimensions);
      restoreMeasurementOverrides();
      onMeasureLayoutComplete?.(null, dimensions);

      return restoreAnchoringStyles;
    }

    // Subsequent renders while open (when `content` changes).
    setPositionerCssSize(positionerElement, 'max-content');

    const previousDimensions = committedDimensions;
    const newDimensions = getCssDimensions(popupElement);

    // Commit immediately so future content changes have a stable previous size.
    committedDimensions = newDimensions;

    setPopupCssSize(popupElement, previousDimensions);
    restoreMeasurementOverrides();
    onMeasureLayoutComplete?.(previousDimensions, newDimensions);

    setPositionerCssSize(positionerElement, newDimensions);

    const abortController = new AbortController();

    animationFrame.request(() => {
      setPopupCssSize(popupElement, newDimensions);

      runOnceAnimationsFinish(() => {
        popupElement.style.setProperty(CommonPopupCssVars.popupWidth, 'auto');
        popupElement.style.setProperty(CommonPopupCssVars.popupHeight, 'auto');
      }, abortController.signal);
    });

    return () => {
      abortController.abort();
      animationFrame.cancel();
      restoreAnchoringStyles();
    };
  }

  // `KeepAlive` takes the elements out of the document, where they have no layout. A measurement
  // then gives a size of 0.
  const deactivated = shallowRef(false);
  let cleanup: (() => void) | undefined;

  function stop() {
    cleanup?.();
    cleanup = undefined;
  }

  function readSources() {
    return [
      toValue(parameters.content),
      toValue(parameters.popupElement),
      toValue(parameters.positionerElement),
      toValue(parameters.mounted),
      anchoringStyles.value,
      deactivated.value,
    ];
  }

  // A part gives its element to the store in a `ref` callback, after the watcher read its sources
  // and before `onMounted`. The mount run then sees the elements, and the watcher also fires. A
  // watcher call with the sources of the last run starts no second run, as the dependency list of
  // a React effect does. Without this check, each open runs the first branch and then the later
  // branch.
  let lastSources: unknown[] | undefined;

  function run() {
    stop();
    lastSources = readSources();
    if (!deactivated.value) {
      cleanup = measure();
    }
  }

  onDeactivated(() => {
    deactivated.value = true;
    stop();
  });

  onActivated(() => {
    deactivated.value = false;
  });

  onMounted(run);
  watch(
    readSources,
    (sources) => {
      if (sources.some((source, index) => source !== lastSources?.[index])) {
        run();
      }
    },
    { flush: 'post' },
  );
  onScopeDispose(stop);
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
    [isPhysicalTop ? 'bottom' : 'top']: '0',
    [isPhysicalLeft ? 'right' : 'left']: '0',
  };
}

function overrideElementStyle(element: HTMLElement, property: string, value: string) {
  const originalValue = element.style.getPropertyValue(property);
  element.style.setProperty(property, value);

  return () => {
    element.style.setProperty(property, originalValue);
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const restorers: Array<() => void> = [];

  for (const [key, value] of Object.entries(styles)) {
    restorers.push(overrideElementStyle(element, key, value));
  }

  return restorers.length
    ? () => {
        restorers.forEach((restore) => restore());
      }
    : NOOP;
}

function setPopupCssSize(popupElement: HTMLElement, size: Dimensions | 'auto') {
  const width = size === 'auto' ? 'auto' : `${size.width}px`;
  const height = size === 'auto' ? 'auto' : `${size.height}px`;
  popupElement.style.setProperty(CommonPopupCssVars.popupWidth, width);
  popupElement.style.setProperty(CommonPopupCssVars.popupHeight, height);
}

function setPositionerCssSize(positionerElement: HTMLElement, size: Dimensions | 'max-content') {
  const width = size === 'max-content' ? 'max-content' : `${size.width}px`;
  const height = size === 'max-content' ? 'max-content' : `${size.height}px`;
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerWidth, width);
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerHeight, height);
}
