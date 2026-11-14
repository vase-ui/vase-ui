import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { ownerWindow } from '../../common/owner';
import { AnimationFrame } from '../../common/useAnimationFrame';
import { Timeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { CollapsibleRootChangeEventDetails } from '../root/CollapsibleRoot.vue';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

type TemporaryStyle = Record<string, string>;

/**
 * Puts declarations in the style that the part renders, and returns the function that takes them
 * out again.
 */
type RecordTemporaryStyle = (declarations: TemporaryStyle) => () => void;

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

export function useCollapsiblePanel(
  parameters: UseCollapsiblePanelParameters,
): UseCollapsiblePanelReturnValue {
  const { onOpenChange, setMounted, setOpen } = parameters;

  const isOpen = () => toValue(parameters.open);
  const isMounted = () => toValue(parameters.mounted);
  const isHiddenUntilFound = () => toValue(parameters.hiddenUntilFound);
  const getTransitionStatus = () => toValue(parameters.transitionStatus);

  // Vue calls the `ref` setter during the render of the part. A reactive read there would make the
  // render depend on it, so the element is a plain variable.
  let panel: HTMLElement | null = null;
  // A part does not render again with its parent. Each value that the render reads is a
  // `shallowRef`, so a change of the value renders the part.
  const animationType = shallowRef<AnimationType | null>(null);
  const dimensions = shallowRef<Dimensions>(EMPTY_DIMENSIONS);
  const lastMeasuredDimensions = shallowRef<Dimensions>(EMPTY_DIMENSIONS);
  // A `beforematch` open shows the matched content at once. The next open skips the motion that
  // the author defined, one time. The open after that is normal.
  let shouldSkipNextOpen = false;
  // A keyframe animation of a panel that mounts open moves the layout in the first paint of a
  // server-rendered page. The first open has no animation until the panel was closed one time.
  const shouldPreventMountAnimation = shallowRef(isOpen());
  // `KeepAlive` moves the DOM of a deactivated panel out of the document. When the DOM comes back,
  // the browser plays the keyframe animation of an open panel again. A render while the panel is
  // deactivated puts `animation-name: none` on the element, so no animation runs after the
  // activation.
  const shouldPreventActivityResumeAnimation = shallowRef(false);
  // Some open paths skip the motion, but the status of the root changes in a later frame. The
  // panel stays idle until then, so its data attributes and its size match the open state.
  const forcePanelIdle = shallowRef(false);
  let pendingTemporaryStyleRestore: (() => void) | null = null;
  // Vue writes each key of the rendered style again on each render. A temporary inline style that
  // the code writes to the DOM is also in this record. The part merges the record after the style
  // of the consumer, so a render does not put the value of the consumer back.
  const temporaryStyle = shallowRef<TemporaryStyle | undefined>();

  const runOnceCloseAnimationsFinish = useAnimationsFinished(() => panel);

  const hidden = computed(() => !isOpen() && !isMounted());
  const panelTransitionStatus = computed(() =>
    forcePanelIdle.value ? 'idle' : getTransitionStatus(),
  );
  const shouldPreventOpenAnimation = computed(
    () =>
      isOpen() && (shouldPreventMountAnimation.value || shouldPreventActivityResumeAnimation.value),
  );
  // When a keyframe panel closes, the live dimensions are `auto` until the effect measures them.
  // This fallback renders the last measured size in that time, so the animation starts from pixels.
  const renderedDimensions = computed(() =>
    !isOpen() &&
    isMounted() &&
    animationType.value === 'css-animation' &&
    dimensions.value.height === undefined &&
    dimensions.value.width === undefined
      ? lastMeasuredDimensions.value
      : dimensions.value,
  );
  const shouldPersistHiddenTransitionStyles = computed(
    () => isHiddenUntilFound() && hidden.value && animationType.value !== 'css-animation',
  );

  // A keyframe close uses the last measured size. `false` only clears the current dimensions.
  function setDimensions(nextDimensions: Dimensions, shouldCacheMeasurement = true) {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensions.value = nextDimensions;
    }

    dimensions.value = nextDimensions;
  }

  const recordTemporaryStyle: RecordTemporaryStyle = (declarations) => {
    temporaryStyle.value = { ...temporaryStyle.value, ...declarations };

    let isRecorded = true;
    return () => {
      if (!isRecorded) {
        return;
      }
      isRecorded = false;

      const remaining = { ...temporaryStyle.value };
      for (const property of Object.keys(declarations)) {
        delete remaining[property];
      }
      temporaryStyle.value = Object.keys(remaining).length > 0 ? remaining : undefined;
    };
  };

  function restorePendingTemporaryStyle() {
    pendingTemporaryStyleRestore?.();
    pendingTemporaryStyleRestore = null;
  }

  function setPendingTemporaryStyleRestore(restore: () => void) {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestore = () => {
      pendingTemporaryStyleRestore = null;
      restore();
    };
  }

  // The write of the measured size reaches the DOM in the next update of Vue. Vue applies the
  // state write of an animation frame in the microtask after the frame callback, so
  // `data-ending-style` can reach the DOM before the browser computes a style with the size in
  // pixels. The height then goes from `auto` to `0`, and no transition runs. A read of the layout
  // after the update gives the browser that style.
  function readLayoutAfterUpdate() {
    void nextTick(() => {
      panel?.getBoundingClientRect();
    });
  }

  // `KeepAlive` keeps the state of a deactivated part. The effects below do not run for a
  // deactivated panel, because the element is out of the document and its computed style is empty.
  let isDeactivated = false;
  let cleanupSizeEffect: (() => void) | undefined;
  let cleanupCloseEffect: (() => void) | undefined;

  // If `KeepAlive` deactivates an open panel with a keyframe animation, the next reveal must not
  // play the open animation again.
  function markActivityResumeAnimationSuppressed() {
    if (isOpen() && isMounted() && animationType.value === 'css-animation') {
      shouldPreventActivityResumeAnimation.value = true;
    }
  }

  // `forcePanelIdle` is a temporary override. Keep it while the root still has the status
  // `starting`, and drop it when the status changes.
  watch([forcePanelIdle, getTransitionStatus], () => {
    if (!forcePanelIdle.value || getTransitionStatus() === 'starting') {
      return;
    }

    forcePanelIdle.value = false;
  });

  function runSizeEffect() {
    cleanupSizeEffect?.();
    cleanupSizeEffect = undefined;

    if (isDeactivated) {
      return;
    }

    const open = isOpen();
    const mounted = isMounted();
    const transitionStatus = getTransitionStatus();

    // A render function can remove the element when the panel closes. The suppression of the open
    // animation is for one open, so clear it also when there is no element.
    if (!open) {
      shouldPreventMountAnimation.value = false;
      shouldPreventActivityResumeAnimation.value = false;
    }

    if (!panel) {
      return;
    }

    // A `beforematch` open sets a duration of `0s`. Restore the duration of the author before the
    // detection of the animation type of the next close. Otherwise the close is read as "no
    // motion", and the close has no transition or animation.
    if (!open && pendingTemporaryStyleRestore) {
      restorePendingTemporaryStyle();
    }

    const nextAnimationType = getAnimationType(panel, shouldPreventOpenAnimation.value);
    animationType.value = nextAnimationType;

    // The first open of a keyframe panel has no animation. The part caches the open size, so the
    // first close animation starts from pixels and not from `auto`.
    if (
      open &&
      transitionStatus === 'idle' &&
      shouldPreventMountAnimation.value &&
      nextAnimationType === 'css-animation'
    ) {
      lastMeasuredDimensions.value = getDimensions(panel);
      return;
    }

    // The opening pass measures the open size. For a `beforematch` open, it also removes the motion
    // of the author, so that find-in-page does not wait for a transition or an animation.
    if (open && transitionStatus === 'starting') {
      const skipNextOpen = shouldSkipNextOpen;
      shouldSkipNextOpen = false;

      if (nextAnimationType === 'none') {
        setDimensions(getDimensions(panel));
        forcePanelIdle.value = true;
        return;
      }

      if (nextAnimationType === 'css-transition') {
        const restoreLayoutStyles = resetLayoutStyles(panel, recordTemporaryStyle);
        setDimensions(getDimensions(panel));

        if (!skipNextOpen) {
          cleanupSizeEffect = restoreLayoutStyles;
          return;
        }

        const restoreTransitionDuration = setTemporaryStyle(
          panel,
          'transition-duration',
          '0s',
          recordTemporaryStyle,
        );
        setPendingTemporaryStyleRestore(restoreTransitionDuration);
        forcePanelIdle.value = true;
        cleanupSizeEffect = restoreLayoutStyles;
        return;
      }

      setDimensions(getDimensions(panel));

      const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
      if (!skipNextOpen) {
        restoreAnimationName();
        return;
      }

      const restoreAnimationDuration = setTemporaryStyle(
        panel,
        'animation-duration',
        '0s',
        recordTemporaryStyle,
      );

      restoreAnimationName();
      setPendingTemporaryStyleRestore(restoreAnimationDuration);
      forcePanelIdle.value = true;

      return;
    }

    // The size is captured when the close is requested, before the deferred ending phase applies the
    // closed styles. An interrupted open then also closes from a size in pixels.
    if (!open && mounted && (transitionStatus === 'idle' || transitionStatus === 'starting')) {
      if (nextAnimationType === 'none') {
        setDimensions(EMPTY_DIMENSIONS, false);
        setMounted(false);
        return;
      }

      setDimensions(getDimensions(panel));
      readLayoutAfterUpdate();
      return;
    }

    if (transitionStatus !== 'ending') {
      return;
    }

    // The status can be `ending` before this effect ran, so the branch above did not run. With no
    // motion there is nothing to wait for, so the panel unmounts here.
    if (nextAnimationType === 'none') {
      setMounted(false);
      return;
    }

    const nextDimensions = getDimensions(panel);
    const hasMeasuredSize = nextDimensions.height > 0 || nextDimensions.width > 0;

    if (!hasMeasuredSize) {
      setMounted(false);
      return;
    }

    setDimensions(nextDimensions);

    if (nextAnimationType === 'css-animation') {
      const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
      restoreAnimationName();
    }
  }

  onMounted(runSizeEffect);
  watch([isMounted, isOpen, shouldPreventOpenAnimation, getTransitionStatus], runSizeEffect, {
    flush: 'post',
  });

  useOpenChangeComplete({
    enabled: () => isOpen() && isMounted() && panelTransitionStatus.value === 'idle',
    open: true,
    ref: () => panel,
    onComplete() {
      // The `finished` promise of an animation can resolve after `open` changed and before the
      // wait is aborted. A clear of the measured size then makes the close transition start from
      // `height: 0` and not from the open size.
      if (!isOpen()) {
        return;
      }

      setDimensions(EMPTY_DIMENSIONS, false);
    },
  });

  // A closing panel needs more than `useOpenChangeComplete`. This effect runs after the update that
  // applies `data-ending-style`. Chrome can register the exit transition one frame late when an
  // accordion closes one item and opens another, so the effect waits one frame before it waits for
  // the animations.
  // See https://github.com/mui/base-ui/issues/3099
  function runCloseEffect() {
    cleanupCloseEffect?.();
    cleanupCloseEffect = undefined;

    if (isDeactivated) {
      return;
    }

    if (isOpen() || !isMounted() || panelTransitionStatus.value !== 'ending') {
      return;
    }

    if (!panel) {
      // A render function can remove the element in the ending phase. Nothing is left to animate,
      // so the close completes at once.
      setMounted(false);
      setDimensions(EMPTY_DIMENSIONS, false);
      return;
    }

    const abortController = new AbortController();

    function handleComplete() {
      // The effect aborts the wait only when it runs again, and the `finished` promise of an
      // animation can resolve before that. The unmount of a panel that has opened again would
      // remove it from the DOM.
      if (isOpen()) {
        return;
      }

      setMounted(false);
      setDimensions(EMPTY_DIMENSIONS, false);
    }

    const endingStyleFrame = AnimationFrame.request(() => {
      runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
    });

    cleanupCloseEffect = () => {
      AnimationFrame.cancel(endingStyleFrame);
      abortController.abort();
    };
  }

  onMounted(runCloseEffect);
  watch([isMounted, isOpen, panelTransitionStatus], runCloseEffect, { flush: 'post' });

  // The props give the string `until-found` to the element, so the server HTML has
  // `hidden="until-found"` with Vue 3.5.41 or later. A server of an earlier Vue writes a bare
  // `hidden`, and hydration does not patch an attribute. The write at mount corrects it.
  // A transition keeps running when the element gets `hidden="until-found"`, because the content
  // is hidden with `content-visibility` and the element has no `display: none`. So when the panel
  // becomes hidden, the element first gets a plain `hidden` for one style computation. The browser
  // then cancels the transitions that still run.
  function writeUntilFoundAttribute(isBecomingHidden: boolean) {
    if (isDeactivated || !panel || !isHiddenUntilFound() || !hidden.value) {
      return;
    }

    if (isBecomingHidden) {
      panel.setAttribute('hidden', '');
      ownerWindow(panel).getComputedStyle(panel).getPropertyValue('display');
    }

    panel.setAttribute('hidden', 'until-found');
  }

  onMounted(() => writeUntilFoundAttribute(false));
  watch(
    [hidden, isHiddenUntilFound],
    ([nextHidden], [previousHidden]) => writeUntilFoundAttribute(nextHidden && !previousHidden),
    { flush: 'post' },
  );

  const revealDecisionTimeout = Timeout.create();
  let revertRevealFrame = -1;

  function clearRevealRevert() {
    revealDecisionTimeout.clear();
    AnimationFrame.cancel(revertRevealFrame);
  }

  // The revert must wait until the browser has measured the match. Vue cannot do the revert: the
  // props of a closed panel do not change, so Vue does not write the attributes that the browser
  // changed (the browser removes `hidden` in the reveal).
  // A task decides if the open arrived, and a frame writes the DOM. A busy main thread can delay a
  // frame, and the frame could then read a value that is not current. When the consumer ignores the
  // open, the state does not change and the decision holds.
  function scheduleRevealRevert(
    revealedPanel: HTMLElement,
    revertSkippedMotion: boolean,
    restoreStartingStyle: boolean,
  ) {
    revealDecisionTimeout.start(0, () => {
      if (isOpen()) {
        return;
      }

      revertRevealFrame = AnimationFrame.request(() => {
        if (isOpen()) {
          return;
        }

        if (revertSkippedMotion) {
          // The open did not happen, so the next open is a normal open with the motion of the
          // author.
          shouldSkipNextOpen = false;
        }

        if (restoreStartingStyle) {
          revealedPanel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
        }

        revealedPanel.setAttribute('hidden', 'until-found');
      });
    });
  }

  function handleBeforeMatch(event: Event) {
    // The listener is a prop of the element, so the element is `currentTarget`, also when a
    // `#render` slot gives another element.
    const revealedPanel = event.currentTarget as HTMLElement;
    const eventDetails = createChangeEventDetails(REASONS.none, event);

    onOpenChange(true, eventDetails);

    if (eventDetails.isCanceled) {
      // The panel must stay hidden. The revert writes `hidden` again, so the content stays
      // searchable.
      scheduleRevealRevert(revealedPanel, false, false);
      return;
    }

    shouldSkipNextOpen = true;

    // The browser removes `hidden` and measures the match in the task that dispatches this event.
    // The state update below reaches the DOM in a later task. A panel that the kept starting style
    // collapses has no size at that time, and the match has no highlight. So the handler removes
    // that style at once.
    const hadStartingStyle = revealedPanel.hasAttribute(
      CollapsiblePanelDataAttributes.startingStyle,
    );
    revealedPanel.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);

    setOpen(true);

    // A controlled root can ignore the open. The panel then goes back to the closed state when the
    // browser has measured the match.
    scheduleRevealRevert(revealedPanel, true, hadStartingStyle);
  }

  onDeactivated(() => {
    isDeactivated = true;
    cleanupSizeEffect?.();
    cleanupSizeEffect = undefined;
    cleanupCloseEffect?.();
    cleanupCloseEffect = undefined;
    markActivityResumeAnimationSuppressed();
    restorePendingTemporaryStyle();
    clearRevealRevert();
  });

  onActivated(() => {
    // `onActivated` also runs at the first mount inside `KeepAlive`, where the effects ran at mount.
    if (!isDeactivated) {
      return;
    }

    isDeactivated = false;
    runSizeEffect();
    runCloseEffect();
  });

  onScopeDispose(() => {
    cleanupSizeEffect?.();
    cleanupCloseEffect?.();
    restorePendingTemporaryStyle();
    clearRevealRevert();
  });

  const props = computed(() => ({
    ...(shouldPersistHiddenTransitionStyles.value
      ? { [CollapsiblePanelDataAttributes.startingStyle]: '' }
      : undefined),
    // The value is never `false`. A render function can give an element that has no `hidden`
    // property, such as an `<svg>`, and Vue writes `false` there as `hidden="false"`.
    hidden: hidden.value ? (isHiddenUntilFound() ? 'until-found' : true) : undefined,
    id: toValue(parameters.id),
    onBeforematch: handleBeforeMatch,
  }));

  return {
    height: computed(() => renderedDimensions.value.height),
    props,
    ref(element) {
      panel = element;
    },
    shouldPreventOpenAnimation,
    shouldRender: computed(
      () => toValue(parameters.keepMounted) || isHiddenUntilFound() || isMounted() || isOpen(),
    ),
    temporaryStyle: computed(() => temporaryStyle.value),
    transitionStatus: panelTransitionStatus,
    width: computed(() => renderedDimensions.value.width),
  };
}

function getDimensions(element: HTMLElement) {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(
  element: HTMLElement,
  hasSuppressedMountAnimation: boolean,
): AnimationType {
  const panelStyles = ownerWindow(element).getComputedStyle(element);
  const hasAnimation =
    (panelStyles.animationName
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration);
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration);

  if (hasAnimation && hasTransition) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        'A panel of Collapsible or Accordion has a CSS transition and a CSS animation.',
        'The part waits for one of them only, so it treats the panel as a transition.',
        'Use only a transition or only an animation on the panel.',
      );
    }

    return 'css-transition';
  }

  if (hasTransition) {
    return 'css-transition';
  }

  if (hasAnimation) {
    return 'css-animation';
  }

  return 'none';
}

function hasNonZeroDuration(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .some((part) => part !== '' && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 * @param element - The element whose inline style should be updated.
 * @param property - The CSS property name to override.
 * @param value - The temporary value to assign.
 * @param record - Puts the declaration in the style that the part renders, until the cleanup runs.
 * A declaration that is set and restored in the same run needs no record.
 * @returns A cleanup function that restores the original inline style state.
 */
function setTemporaryStyle(
  element: HTMLElement,
  property: string,
  value: string,
  record?: RecordTemporaryStyle,
): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);
  const forget = record?.({ [property]: value });

  return () => {
    forget?.();

    if (previousValue === '') {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 * @param element - The panel element being measured.
 * @param record - Puts the reset in the style that the part renders, until the restore runs.
 * @returns A cleanup function that cancels the scheduled restore and reapplies
 * the original inline layout styles immediately.
 */
function resetLayoutStyles(element: HTMLElement, record: RecordTemporaryStyle): () => void {
  const originalLayoutStyles = {
    'justify-content': element.style.justifyContent,
    'align-items': element.style.alignItems,
    'align-content': element.style.alignContent,
    'justify-items': element.style.justifyItems,
  };

  const resets: TemporaryStyle = {};
  Object.keys(originalLayoutStyles).forEach((key) => {
    element.style.setProperty(key, 'initial', 'important');
    resets[key] = 'initial !important';
  });
  const forget = record(resets);

  function restoreLayoutStyles() {
    forget();

    Object.entries(originalLayoutStyles).forEach(([key, value]) => {
      if (value === '') {
        element.style.removeProperty(key);
        return;
      }

      element.style.setProperty(key, value);
    });
  }

  const frame = AnimationFrame.request(restoreLayoutStyles);

  return () => {
    AnimationFrame.cancel(frame);
    restoreLayoutStyles();
  };
}

export interface UseCollapsiblePanelParameters {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: MaybeRefOrGetter<boolean>;
  /**
   * The `id` attribute of the panel.
   */
  id: MaybeRefOrGetter<string | undefined>;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: MaybeRefOrGetter<boolean>;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: MaybeRefOrGetter<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: MaybeRefOrGetter<boolean>;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  transitionStatus: MaybeRefOrGetter<TransitionStatus>;
}

export interface UseCollapsiblePanelReturnValue {
  height: ComputedRef<number | undefined>;
  /**
   * `hidden`, `id`, the kept `data-starting-style` and the `beforematch` listener.
   */
  props: ComputedRef<Record<string, any>>;
  /**
   * The part gives it to `useRenderElement` in `ref`.
   */
  ref: (element: HTMLElement | null) => void;
  shouldPreventOpenAnimation: ComputedRef<boolean>;
  shouldRender: ComputedRef<boolean>;
  /**
   * The temporary declarations that the part merges after the style of the consumer.
   */
  temporaryStyle: ComputedRef<TemporaryStyle | undefined>;
  transitionStatus: ComputedRef<TransitionStatus>;
  width: ComputedRef<number | undefined>;
}
