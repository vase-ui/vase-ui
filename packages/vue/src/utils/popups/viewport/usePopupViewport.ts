import { positionerVars } from '../../../internals/useAnchorPositioning';
import {
  computed,
  onBeforeMount,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
  inject,
  nextTick,
  normalizeStyle,
  onMounted,
  toValue,
} from 'vue';
import type { CSSProperties, MaybeRefOrGetter } from 'vue';
import type { Dimensions } from '@floating-ui/utils';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import { useDirection } from '../../../internals/direction-context/DirectionContext';
import type { StateAttributesMapping } from '../../../internals/getStateAttributesProps';
import type { Side } from '../../../internals/useAnchorPositioning';
import { useAnimationsFinished } from '../../../internals/useAnimationsFinished';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import type { PopupPositionerStore } from '../usePopupPositioner';
import type { VaseUIComponentProps } from '../../../internals/types';
import { useRenderElement } from '../../../internals/useRenderElement';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import type { AdaptiveOriginMiddleware } from '../positioning/adaptiveOriginMiddleware';
import { PopupViewportContext, PopupStyleContext } from './PopupViewportContext';
import { EMPTY_OBJECT } from '../../../common/empty';
import { useDomEffect } from '../useDomEffect';
import { getCssDimensions } from '../../getCssDimensions';

const popupVars = {
  popupWidth: '--popup-width',
  popupHeight: '--popup-height',
} as const;

const popupViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: (value) =>
    value
      ? {
          'data-activation-direction': value,
        }
      : null,
};

interface PopupViewportState<Instant> {
  instant: Instant;
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

type PopupViewportStore<Instant> = {
  select(key: 'instantType'): NoInfer<Instant>;
  readonly state: { readonly instantType: Instant };
  set(key: 'adaptiveOrigin', value: AdaptiveOriginMiddleware | undefined): void;
} & PopupPositionerStore;

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

const CONTROLS = new Set(['input', 'select', 'textarea', 'button']);

/**
 * Removes the `id` of each HTML element and the `name` of each control. A second element with the
 * same id, or a second radio in the same group, then never exists while the picture shows.
 * An SVG element keeps its `id`, because `url(#id)` paints by it.
 */
function removeIdentities(root: Element) {
  for (const element of [root, ...root.querySelectorAll('[id], [name]')]) {
    if (element.namespaceURI !== HTML_NAMESPACE) {
      continue;
    }
    element.removeAttribute('id');
    if (CONTROLS.has(element.localName)) {
      element.removeAttribute('name');
    }
  }
}

/**
 * Clones the content of a container. The clone has the DOM of the moment, so it also has what a
 * component changed by itself.
 */
function takePicture(container: Element): Node[] {
  const picture = Array.from(container.childNodes, (node) => node.cloneNode(true));
  for (const node of picture) {
    if (node.nodeType === 1) {
      removeIdentities(node as Element);
    }
  }
  return picture;
}

/**
 * Builds morphing viewport containers for popups that animate between trigger-based content.
 * Handles previous-content snapshots, auto-resize, and state attributes for transitions.
 *
 * Call it in `setup` of the viewport part. It provides the context of `PopupViewportChildren`,
 * which renders the containers.
 */
export function usePopupViewport<Instant extends string | undefined>(
  props: VaseUIComponentProps<PopupViewportState<NoInfer<Instant>>>,
  store: PopupViewportStore<Instant>,
  side: MaybeRefOrGetter<Side>,
) {
  const direction = useDirection();

  const open = computed(() => store.select('open'));
  const mounted = computed(() => store.select('mounted'));
  const activeTriggerElement = computed(() => store.select('activeTriggerElement'));
  const activeTriggerId = computed(() => store.select('activeTriggerId'));
  const payload = computed(() => store.select('payload'));
  const popupElement = computed(() => store.select('popupElement'));
  const positionerElement = computed(() => store.select('positionerElement'));

  const contentCount = shallowRef(0);
  const previousContent = shallowRef<Node[] | null>(null);
  const showStartingStyle = shallowRef(false);
  const triggerOffset = shallowRef<Offset | null>(null);
  const previousContentDimensions = shallowRef<Dimensions | null>(null);
  const currentContainerRef = shallowRef<HTMLElement | null>(null);
  const previousContainerRef = shallowRef<HTMLElement | null>(null);

  const transitioning = computed(() => previousContent.value !== null);
  const isStarting = computed(() => transitioning.value && showStartingStyle.value);
  // The key mounts the current container again when the trigger changes, and once more when the
  // payload comes later. The new content then never reuses the DOM of the old content.
  const currentContentKey = computed(
    () => `${activeTriggerId.value ?? 'current'}-${contentCount.value}`,
  );
  const previousContainerStyle = computed<CSSProperties>(() => {
    const dimensions = previousContentDimensions.value;
    return {
      ...(dimensions
        ? {
            [popupVars.popupWidth]: `${dimensions.width}px`,
            [popupVars.popupHeight]: `${dimensions.height}px`,
          }
        : null),
      position: 'absolute',
    };
  });

  let isPayloadPending = false;
  watch([activeTriggerId, payload], ([id, nextPayload], [previousId, previousPayload]) => {
    const hasTriggerIdChanged = id !== previousId;
    const hasPayloadChanged = nextPayload !== previousPayload;

    if (hasTriggerIdChanged) {
      contentCount.value += 1;
      isPayloadPending = !hasPayloadChanged;
    } else if (isPayloadPending && hasPayloadChanged) {
      contentCount.value += 1;
      isPayloadPending = false;
    }
  });

  // The watcher runs before the render of the change, so the container still has the old content.
  // A trigger that remounts while the popup is closed is `null` here, so it starts no transition.
  const activeTrigger = computed(() => (open.value ? activeTriggerElement.value : null));
  watch(activeTrigger, (trigger, previousTrigger) => {
    const container = currentContainerRef.value;
    if (trigger === null || previousTrigger === null || container === null) {
      return;
    }

    previousContent.value = takePicture(container);
    // A trigger that `KeepAlive` holds is not on the page, so the change has no direction.
    triggerOffset.value =
      previousTrigger.isConnected && trigger.isConnected
        ? calculateRelativePosition(previousTrigger, trigger)
        : null;
  });

  let cleanupController: AbortController | undefined;

  // A payload that comes later mounts the current container again while the transition runs. The
  // new container needs the starting style, and the wait of the old container ends.
  watch([currentContentKey, previousContent], () => {
    if (previousContent.value === null) {
      return;
    }

    cleanupController?.abort();
    showStartingStyle.value = true;
  });

  watch(
    previousContent,
    (content) => {
      if (content !== null) {
        previousContainerRef.value?.replaceChildren(...content);
      }
    },
    { flush: 'post' },
  );

  const cleanupFrame = useAnimationFrame();
  const runOnceAnimationsFinish = useAnimationsFinished(
    currentContainerRef,
    true,
    false,
    () => isStarting.value,
  );

  watch(
    [currentContentKey, previousContent],
    () => {
      if (previousContent.value === null) {
        return;
      }

      // The browser must compute the style of the container with the starting style. Without it,
      // the enter transition does not start.
      currentContainerRef.value?.getBoundingClientRect();

      cleanupFrame.request(() => {
        const controller = new AbortController();
        cleanupController = controller;
        runOnceAnimationsFinish(() => {
          previousContent.value = null;
          previousContentDimensions.value = null;
        }, controller.signal);
        showStartingStyle.value = false;
      });
    },
    { flush: 'post' },
  );

  const viewportStyles = usePopupAutoResize({
    popupElement,
    positionerElement,
    mounted,
    content: payload,
    side,
    direction,
    onMeasureLayout() {
      currentContainerRef.value?.style.setProperty('animation', 'none');
      currentContainerRef.value?.style.setProperty('transition', 'none');

      previousContainerRef.value?.style.setProperty('display', 'none');
    },
    onMeasureLayoutComplete(previousDimensions) {
      currentContainerRef.value?.style.removeProperty('animation');
      currentContainerRef.value?.style.removeProperty('transition');

      previousContainerRef.value?.style.removeProperty('display');

      if (previousDimensions) {
        previousContentDimensions.value = previousDimensions;
      }
    },
  });

  // `KeepAlive` takes the containers out of the document and cancels their animations. The
  // animations start again at the activation, so the morph ends at the deactivation.
  const { isHeld } = useKeepAliveState();
  watch(
    isHeld,
    (held) => {
      if (held) {
        cleanupFrame.cancel();
        cleanupController?.abort();
        previousContent.value = null;
        previousContentDimensions.value = null;
      }
    },
    { flush: 'sync' },
  );

  function releaseViewport() {
    if (store.context.viewportStyles.value === viewportStyles) {
      store.context.viewportStyles.value = null;
      store.set('adaptiveOrigin', undefined);
    }
  }

  // Descendants need the middleware before they mount. A detached popup keeps its last size.
  onBeforeMount(() => {
    watch(
      [isHeld, () => isHeld.value && popupElement.value?.isConnected],
      ([held, hasLivePopup]) => {
        if (!held) {
          store.context.viewportStyles.value = viewportStyles;
          store.set('adaptiveOrigin', adaptiveOrigin);
        } else if (hasLivePopup) {
          releaseViewport();
        }
      },
      { immediate: true, flush: 'post' },
    );
  });
  onScopeDispose(() => {
    releaseViewport();
    cleanupController?.abort();
  });

  provide(PopupViewportContext, {
    currentContentKey,
    transitioning,
    showStartingStyle: isStarting,
    previousContainerStyle,
    currentContainerRef,
    previousContainerRef,
  });

  const state = computed<PopupViewportState<Instant>>(() => ({
    instant: store.select('instantType'),
    activationDirection: getActivationDirection(triggerOffset.value),
    transitioning: transitioning.value,
  }));

  return {
    state,
    ...useRenderElement('div', props, {
      state,
      stateAttributesMapping: popupViewportStateMapping,
      children: true,
    }),
  };
}

export type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 *
 * @param offset
 */
export function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, 'right', 'left')} ${getValueWithTolerance(offset.vertical, 5, 'down', 'up')}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 *
 * @param value Value to check
 * @param tolerance Tolerance to treat the value as zero.
 * @param positiveLabel
 * @param negativeLabel
 * @returns If 0 < abs(value) < tolerance, returns an empty string. Otherwise returns positiveLabel or negativeLabel.
 */
function getValueWithTolerance(
  value: number,
  tolerance: number,
  positiveLabel: string,
  negativeLabel: string,
) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return '';
}

/**
 * Calculates the relative position between centers of two elements.
 */
export function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 * Call it in `setup`.
 */
export function usePopupAutoResize(parameters: UsePopupAutoResizeParameters) {
  const { onMeasureLayout, onMeasureLayoutComplete } = parameters;

  const animationFrame = useAnimationFrame();

  let committedDimensions: Dimensions | null = null;

  const { isHeld } = useKeepAliveState();
  const ready = shallowRef(false);
  onMounted(() => {
    ready.value = true;
  });

  const readPopup = () => toValue(parameters.popupElement);
  const readPositioner = () => toValue(parameters.positionerElement);
  const readContent = () => toValue(parameters.content);
  const runOnceAnimationsFinish = useAnimationsFinished(readPopup, true);
  const readMounted = () => toValue(parameters.mounted);
  const anchoringStyles = computed(() =>
    getPopupAnchoringStyles(toValue(parameters.side), toValue(parameters.direction)),
  );
  const readPopupStyle = inject(PopupStyleContext, undefined);
  // An ancestor's deactivation hook reads the detached popup before Vue can patch its style.
  useDomEffect(
    [readPopup, readMounted, anchoringStyles],
    () => {
      const popup = readPopup();
      if (!popup || !readMounted()) {
        return undefined;
      }
      const anchors = Object.entries(anchoringStyles.value);
      return () => {
        if (!isHeld.value || !anchors.length) {
          return;
        }
        const rendered = normalizeStyle([readPopupStyle?.()]);
        for (const [key, value] of anchors) {
          if (
            !(typeof rendered === 'object' && rendered[key] != null) &&
            popup.style.getPropertyValue(key) === value &&
            !popup.style.getPropertyPriority(key)
          ) {
            popup.style.removeProperty(key);
          }
        }
      };
    },
    isHeld,
  );
  const popupSize = shallowRef<Dimensions | 'auto' | null>(null);
  const positionerSize = shallowRef<Dimensions | null>(null);
  const active = computed(() => ready.value && !isHeld.value && readMounted());
  watch(
    [active, readPopup, readPositioner, readContent, anchoringStyles],
    ([shown, popup, positioner], _, onCleanup) => {
      if (!readMounted()) {
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
        [positionerVars.availableWidth]: 'max-content',
        [positionerVars.availableHeight]: 'max-content',
        [positionerVars.positionerWidth]: 'max-content',
        [positionerVars.positionerHeight]: 'max-content',
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
    popup: computed(() => ({
      ...(active.value && anchoringStyles.value),
      ...popupSizeStyles(popupSize.value),
    })),
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

export function popupSizeStyles(size: Dimensions | 'auto' | null) {
  return (
    size && {
      [popupVars.popupWidth]: size === 'auto' ? size : `${size.width}px`,
      [popupVars.popupHeight]: size === 'auto' ? size : `${size.height}px`,
    }
  );
}

export function positionerSizeStyles(size: Dimensions | null) {
  return (
    size && {
      [positionerVars.positionerWidth]: `${size.width}px`,
      [positionerVars.positionerHeight]: `${size.height}px`,
    }
  );
}
