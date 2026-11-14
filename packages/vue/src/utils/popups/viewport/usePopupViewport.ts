import {
  computed,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from 'vue';
import type { ComputedRef, CSSProperties, MaybeRefOrGetter } from 'vue';
import type { Dimensions } from '@floating-ui/utils';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import { useDirection } from '../../../internals/direction-context/DirectionContext';
import type { StateAttributesMapping } from '../../../internals/getStateAttributesProps';
import type { Side } from '../../../internals/useAnchorPositioning';
import { useAnimationsFinished } from '../../../internals/useAnimationsFinished';
import type { usePopupPositioner } from '../popupPositioner';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import type { AdaptiveOriginMiddleware } from '../positioning/adaptiveOriginConstants';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonViewportDataAttributes from './CommonViewportDataAttributes';
import { PopupViewportContext } from './PopupViewportContext';
import { usePopupAutoResize } from './usePopupAutoResize';

export const popupViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: (value) =>
    value
      ? {
          [CommonViewportDataAttributes.activationDirection]: value,
        }
      : null,
};

export interface PopupViewportState {
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

type PopupViewportStore = Parameters<typeof usePopupPositioner>[0] & {
  set(key: 'adaptiveOrigin', value: AdaptiveOriginMiddleware | undefined): void;
};

export interface UsePopupViewportParameters {
  /**
   * Popup store instance for accessing shared popup state. The store stays the same while the
   * part exists.
   */
  store: PopupViewportStore;
  /**
   * Side of the positioner relative to the trigger.
   */
  side: MaybeRefOrGetter<Side>;
}

export interface UsePopupViewportResult {
  /**
   * Viewport state used for data attributes and render prop styling.
   */
  state: ComputedRef<PopupViewportState>;
}

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
export function usePopupViewport(parameters: UsePopupViewportParameters): UsePopupViewportResult {
  const { store, side } = parameters;

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
            [CommonPopupCssVars.popupWidth]: `${dimensions.width}px`,
            [CommonPopupCssVars.popupHeight]: `${dimensions.height}px`,
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
    showStartingStyle.value = true;
    triggerOffset.value = calculateRelativePosition(previousTrigger, trigger);
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
  const runOnceAnimationsFinish = useAnimationsFinished(() => currentContainerRef.value, true);

  function armCleanup() {
    cleanupController?.abort();
    const controller = new AbortController();
    cleanupController = controller;
    runOnceAnimationsFinish(() => {
      previousContent.value = null;
      previousContentDimensions.value = null;
    }, controller.signal);
  }

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
        // Vue has no `flushSync`. It applies this write in the microtask after the callback, so
        // the wait still sees the attribute and waits for its removal.
        showStartingStyle.value = false;
        armCleanup();
      });
    },
    { flush: 'post' },
  );

  usePopupAutoResize({
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
  onDeactivated(() => {
    cleanupFrame.cancel();
    cleanupController?.abort();
    previousContent.value = null;
    previousContentDimensions.value = null;
  });

  // The first position pass needs the middleware, and a server renders no pass. A viewport that
  // replaces another one mounts before the old one unmounts, and the old one clears the key.
  onBeforeMount(() => {
    store.set('adaptiveOrigin', adaptiveOrigin);
  });
  onMounted(() => {
    store.set('adaptiveOrigin', adaptiveOrigin);
  });
  onScopeDispose(() => {
    store.set('adaptiveOrigin', undefined);
    cleanupController?.abort();
  });

  provide(PopupViewportContext, {
    currentContentKey,
    transitioning,
    showStartingStyle,
    previousContainerStyle,
    currentContainerRef,
    previousContainerRef,
  });

  const state = computed<PopupViewportState>(() => ({
    activationDirection: getActivationDirection(triggerOffset.value),
    transitioning: transitioning.value,
  }));

  return { state };
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
