import { computed, nextTick, onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';
import { ownerWindow } from '../../common/owner';
import { AnimationFrame } from '../../common/useAnimationFrame';
import { Timeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { given } from '../../internals/givenAttributes';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { REASONS } from '../../internals/reasons';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { isFiniteAnimation } from '../../utils/getFiniteAnimations';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import type { CollapsibleRootContext } from '../root/CollapsibleRootContext';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number;
  width: number;
}

type TemporaryStyle = Record<string, string>;

interface PendingReveal {
  panel: HTMLElement;
  restoreStartingStyle: boolean;
}

export function useCollapsiblePanel(
  root: CollapsibleRootContext,
  options: {
    id?: MaybeRefOrGetter<string | undefined>;
    hiddenUntilFound?: MaybeRefOrGetter<boolean | undefined>;
    keepMounted?: MaybeRefOrGetter<boolean | undefined>;
  },
) {
  const { mounted, setMounted, requestOpen, state, defaultPanelId, registerPanelId } = root;
  const isOpen = () => state.value.open;
  const getTransitionStatus = () => state.value.transitionStatus;
  const isHiddenUntilFound = () => toValue(options.hiddenUntilFound);
  const element: ShallowRef<HTMLElement | null> = shallowRef(null);
  const id = computed(() => given('id', toValue(options.id)) ?? defaultPanelId.value);
  useRegisteredId(() => id.value, registerPanelId, element);

  const animationType = shallowRef<AnimationType | null>(null);
  const dimensions = shallowRef<Dimensions>();
  const lastMeasuredDimensions = shallowRef<Dimensions>();
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
  const instantOpenDuration = shallowRef<'transition-duration' | 'animation-duration'>();
  const layoutStyle = shallowRef<TemporaryStyle>();
  const pendingReveal = shallowRef<PendingReveal>();

  const runOnceCloseAnimationsFinish = useAnimationsFinished(element);
  const hidden = computed(() => !isOpen() && !mounted.value);
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
    !isOpen() && mounted.value && animationType.value === 'css-animation'
      ? (dimensions.value ?? lastMeasuredDimensions.value)
      : dimensions.value,
  );
  function setDimensions(size: Dimensions) {
    lastMeasuredDimensions.value = size;
    dimensions.value = size;
  }

  const { isHeld } = useKeepAliveState();

  // Vue does not patch the style of a node it removes. Save the inline value before the override.
  watch(
    () => isOpen() && !isHeld.value && instantOpenDuration.value,
    (property, _, onCleanup) => {
      const panel = element.value;
      if (!property || !panel) return;
      const value = panel.style.getPropertyValue(property);
      const priority = panel.style.getPropertyPriority(property);
      onCleanup(() => panel.style.setProperty(property, value, priority));
    },
  );

  watch(getTransitionStatus, (status) => {
    if (status !== 'starting') forcePanelIdle.value = false;
  });

  function runSizeEffect(): (() => void) | void {
    const panel = element.value;
    const open = isOpen();
    const transitionStatus = getTransitionStatus();

    // A render function can remove the element when the panel closes. The suppression of the open
    // animation is for one open, so clear it also when there is no element.
    if (!open) {
      instantOpenDuration.value = undefined;
      shouldPreventMountAnimation.value = false;
      shouldPreventActivityResumeAnimation.value = false;
    }

    if (!panel) {
      return;
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
        const restoreLayoutStyles = resetLayoutStyles(panel, layoutStyle);
        setDimensions(getDimensions(panel));

        if (!skipNextOpen) {
          return restoreLayoutStyles;
        }

        instantOpenDuration.value = 'transition-duration';
        forcePanelIdle.value = true;
        return restoreLayoutStyles;
      }

      setDimensions(getDimensions(panel));

      resetAnimationName(panel);
      if (!skipNextOpen) return;

      instantOpenDuration.value = 'animation-duration';
      forcePanelIdle.value = true;

      return;
    }

    // The size is captured when the close is requested, before the deferred ending phase applies the
    // closed styles. An interrupted open then also closes from a size in pixels.
    if (
      !open &&
      mounted.value &&
      (transitionStatus === 'idle' || transitionStatus === 'starting')
    ) {
      if (nextAnimationType === 'none') {
        dimensions.value = undefined;
        setMounted(false);
        return;
      }

      setDimensions(getDimensions(panel));
      // Commit the size in pixels before the next frame applies the exit style.
      void nextTick(() => element.value?.getBoundingClientRect());
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
      resetAnimationName(panel);
    }
  }

  // A held panel is outside the document, so its computed style is empty.
  useDomEffect(
    [mounted, isOpen, shouldPreventOpenAnimation, getTransitionStatus],
    runSizeEffect,
    isHeld,
  );

  useOpenChangeComplete({
    enabled: () => isOpen() && mounted.value && panelTransitionStatus.value === 'idle',
    open: true,
    ref: element,
    onComplete() {
      // The `finished` promise of an animation can resolve after `open` changed and before the
      // wait is aborted. A clear of the measured size then makes the close transition start from
      // `height: 0` and not from the open size.
      if (!isOpen()) {
        return;
      }

      dimensions.value = undefined;
    },
  });

  function completeClose() {
    // The effect aborts the wait only when it runs again, and the `finished` promise of an
    // animation can resolve before that. `animationend` also comes at the end of an enter
    // animation. In both cases the panel can be open. A write of `mounted` `false` then starts
    // the enter of the panel again.
    if (isOpen()) {
      return;
    }

    setMounted(false);
    dimensions.value = undefined;
  }

  // A closing panel needs more than `useOpenChangeComplete`. This effect runs after the update that
  // applies `data-ending-style`. Chrome can register the exit transition one frame late when an
  // accordion closes one item and opens another, so the effect waits one frame before it waits for
  // the animations.
  // See https://github.com/mui/base-ui/issues/3099
  function runCloseEffect() {
    if (isOpen() || !mounted.value || panelTransitionStatus.value !== 'ending') {
      return;
    }

    if (!element.value) {
      // A render function can remove the element in the ending phase. Nothing is left to animate,
      // so the close completes at once.
      completeClose();
      return;
    }

    const abortController = new AbortController();

    const endingStyleFrame = AnimationFrame.request(() => {
      runOnceCloseAnimationsFinish(completeClose, abortController.signal);
    });

    return () => {
      AnimationFrame.cancel(endingStyleFrame);
      abortController.abort();
    };
  }

  useDomEffect([mounted, isOpen, panelTransitionStatus], runCloseEffect, isHeld);

  // The close effect reads the animations of the panel two frames after the ending style. A late
  // frame can end a keyframe exit before that read, and the panel then has its open style again.
  // The browser sends `animationend` in the frame of the end, before the paint. So this listener
  // completes the close before the browser paints the open panel.
  function handleAnimationEnd(event: AnimationEvent) {
    const element = event.currentTarget as HTMLElement;
    if (
      event.target !== element ||
      event.pseudoElement !== '' ||
      element
        .getAnimations()
        .some((animation) => isFiniteAnimation(animation) && animation.playState !== 'finished')
    ) {
      return;
    }

    completeClose();
  }

  // The props give the string `until-found` to the element, so the server HTML has
  // `hidden="until-found"` with Vue 3.5.41 or later. In Vue 3.6, the server writes it from
  // 3.6.0-rc.3. Earlier versions write a bare `hidden`. Vue keeps the server value of `hidden`
  // from a `v-bind` object while it hydrates, so the panel corrects it at the mount.
  // A transition keeps running when the element gets `hidden="until-found"`, because the content
  // is hidden with `content-visibility` and the element has no `display: none`. So when the panel
  // becomes hidden, the element first gets a plain `hidden` for one style computation. The browser
  // then cancels the transitions that still run.
  onMounted(() => {
    watch(
      [hidden, isHiddenUntilFound, element],
      ([closed, searchable, panel], [wasClosed]) => {
        if (!closed || !searchable || !panel || isHeld.value) return;
        if (wasClosed === false) {
          panel.setAttribute('hidden', '');
          ownerWindow(panel).getComputedStyle(panel).getPropertyValue('display');
        }
        panel.setAttribute('hidden', 'until-found');
      },
      { immediate: true, flush: 'post' },
    );
  });

  function finishReveal() {
    const match = pendingReveal.value;
    pendingReveal.value = undefined;
    if (!match || isOpen()) return;
    shouldSkipNextOpen = false;
    if (!isHiddenUntilFound()) return;

    // The browser changed the matched element. Vue can replace it before this frame.
    if (match.restoreStartingStyle) {
      match.panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
    }
    match.panel.setAttribute('hidden', 'until-found');
  }

  function handleBeforeMatch(event: Event) {
    const revealedPanel = event.currentTarget as HTMLElement;
    const eventDetails = createChangeEventDetails(REASONS.none, event);

    requestOpen(true, eventDetails);

    const restoreStartingStyle =
      !eventDetails.isCanceled &&
      revealedPanel.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
    if (!eventDetails.isCanceled) {
      shouldSkipNextOpen = true;
      // The browser measures the match before Vue can patch the panel.
      revealedPanel.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);
    }

    pendingReveal.value = { panel: revealedPanel, restoreStartingStyle };
  }

  watch(
    isHeld,
    (held) => {
      if (held) {
        if (isOpen() && mounted.value && animationType.value === 'css-animation') {
          shouldPreventActivityResumeAnimation.value = true;
        }
        instantOpenDuration.value = undefined;
      } else if (pendingReveal.value) {
        // The parent activation hook can read the panel before Vue patches its attributes.
        finishReveal();
      }
    },
    { flush: 'sync' },
  );

  watch([pendingReveal, isHeld], ([reveal, held], _previous, onCleanup) => {
    if (!reveal || held) {
      return;
    }

    const decisionTimeout = Timeout.create();
    let revertFrame = -1;
    decisionTimeout.start(0, () => {
      if (isOpen()) {
        pendingReveal.value = undefined;
        return;
      }

      revertFrame = AnimationFrame.request(finishReveal);
    });
    onCleanup(() => {
      decisionTimeout.clear();
      AnimationFrame.cancel(revertFrame);
    });
  });

  return {
    element,
    id,
    hidden: computed(() => {
      if (!hidden.value) return undefined;
      return isHiddenUntilFound() ? 'until-found' : true;
    }),
    persistStartingStyle: computed(
      () => isHiddenUntilFound() && hidden.value && animationType.value !== 'css-animation',
    ),
    handleAnimationEnd,
    handleBeforeMatch,
    height: computed(() => sizeInPixels(renderedDimensions.value?.height)),
    width: computed(() => sizeInPixels(renderedDimensions.value?.width)),
    shouldRender: computed(
      () => toValue(options.keepMounted) || isHiddenUntilFound() || !hidden.value,
    ),
    overridingStyle() {
      const duration = isOpen() && instantOpenDuration.value;
      return {
        ...(shouldPreventOpenAnimation.value && { animationName: 'none' }),
        ...(duration && { [duration]: '0s' }),
        ...layoutStyle.value,
      };
    },
    transitionStatus: panelTransitionStatus,
  };
}

function sizeInPixels(size: number | undefined) {
  return size === undefined ? 'auto' : `${size}px`;
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

function resetAnimationName(element: HTMLElement) {
  const { animationName } = element.style;
  const priority = element.style.getPropertyPriority('animation-name');
  element.style.animationName = 'none';
  element.style.setProperty('animation-name', animationName, priority);
}

// The browser needs the reset for the size read in this task. Vue keeps it through the next patch.
function resetLayoutStyles(
  element: HTMLElement,
  layoutStyle: ShallowRef<TemporaryStyle | undefined>,
) {
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
  layoutStyle.value = resets;

  function restoreLayoutStyles() {
    layoutStyle.value = undefined;

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
