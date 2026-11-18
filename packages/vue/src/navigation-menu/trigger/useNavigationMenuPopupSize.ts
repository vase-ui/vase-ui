import { nextTick, onScopeDispose, watch } from 'vue';
import type { Dimensions } from '@floating-ui/utils';
import type { ComputedRef } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerWindow } from '../../common/owner';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import * as TransitionStatusDataAttributes from '../../internals/TransitionStatusDataAttributes';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { NavigationMenuSizes } from '../root/NavigationMenuRootContext';

const DEFAULT_SIZE = { width: 0, height: 0 };

/**
 * Gives the popup the size of the content of the active item. While the active item changes, the
 * popup has a fixed size, so that a CSS transition can run from the old size to the new size. When
 * the transitions end, the popup size goes back to `auto`.
 *
 * Call it in the `setup` of the trigger.
 */
export function useNavigationMenuPopupSize(isActiveItem: ComputedRef<boolean>) {
  const {
    open,
    mounted,
    sizes,
    popupElement,
    positionerElement,
    transitionStatus,
    popupAutoSizeResetRef,
    currentContentRef,
  } = useNavigationMenuRootContext();

  const mutationFrame = useAnimationFrame();
  const resizeFrame = useAnimationFrame();
  const sizeFrame = useAnimationFrame();
  const runOnceAnimationsFinish = useAnimationsFinished(popupElement);

  let prevSize = DEFAULT_SIZE;
  let switchFrom: Dimensions | undefined;
  let pendingMeasurement: NavigationMenuSizes | undefined;
  const owner = Symbol();

  function cancelAutoSizeReset(force = false) {
    if (!force && popupAutoSizeResetRef.owner !== owner) {
      return;
    }

    popupAutoSizeResetRef.abortController?.abort();
    popupAutoSizeResetRef.abortController = null;
    popupAutoSizeResetRef.owner = null;
  }

  function releaseSize() {
    if (pendingMeasurement && sizes.value === pendingMeasurement) {
      sizes.value = { popup: pendingMeasurement.popup, positioner: pendingMeasurement.positioner };
    }
    pendingMeasurement = undefined;
    switchFrom = undefined;
    mutationFrame.cancel();
    resizeFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  }

  watch(
    isActiveItem,
    (active) => {
      if (active) {
        // The current box still shows the previous item until Vue patches the content.
        const popup = popupElement.value;
        if (popup?.isConnected) {
          switchFrom = getCssDimensions(popup);
        }
      } else {
        releaseSize();
      }
    },
    { flush: 'sync' },
  );
  onScopeDispose(releaseSize);

  function ownsPopup(popup: HTMLElement, positioner: HTMLElement) {
    return (
      open.value &&
      isActiveItem.value &&
      popupElement.value === popup &&
      positionerElement.value === positioner &&
      popup.isConnected
    );
  }

  function measure(
    popup: HTMLElement,
    positioner: HTMLElement,
    commit: (size: Dimensions) => void,
  ) {
    if (!ownsPopup(popup, positioner)) {
      return;
    }
    cancelAutoSizeReset(true);
    const previous = sizes.value;
    const measurement = { ...previous, measuring: true };
    sizes.value = measurement;
    pendingMeasurement = measurement;
    void nextTick(() => {
      if (sizes.value !== measurement) {
        return;
      }
      pendingMeasurement = undefined;
      sizes.value = { popup: previous.popup, positioner: previous.positioner };
      if (ownsPopup(popup, positioner)) {
        commit(getCssDimensions(popup));
      }
    });
  }

  function commitTarget(popup: HTMLElement, positioner: HTMLElement, target: Dimensions) {
    if (!ownsPopup(popup, positioner)) {
      return;
    }
    cancelAutoSizeReset(true);
    sizes.value = { popup: target, positioner: target };
    const abortController = new AbortController();
    popupAutoSizeResetRef.abortController = abortController;
    popupAutoSizeResetRef.owner = owner;

    void nextTick(() => {
      if (abortController.signal.aborted) {
        return;
      }
      runOnceAnimationsFinish(() => {
        popupAutoSizeResetRef.abortController = null;
        popupAutoSizeResetRef.owner = null;
        if (ownsPopup(popup, positioner)) {
          sizes.value = { popup: 'auto', positioner: target };
        }
      }, abortController.signal);
    });
  }

  function handleValueChange(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    measure(popup, positioner, ({ width, height }) => {
      const target = { width: width || prevSize.width, height: height || prevSize.height };
      const previous =
        currentWidth && currentHeight ? { width: currentWidth, height: currentHeight } : target;
      sizes.value = { popup: previous, positioner: target };
      sizeFrame.request(() => commitTarget(popup, positioner, target));
    });
  }

  function handleInterruptedMutationResize(
    popup: HTMLElement,
    positioner: HTMLElement,
    current: Dimensions,
  ) {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);
    if (!current.width || !current.height || !ownsPopup(popup, positioner)) {
      return;
    }

    sizes.value = { popup: current, positioner: current };
    mutationFrame.request(() => {
      mutationFrame.request(() => {
        measure(popup, positioner, ({ width, height }) => {
          const target = { width: width || current.width, height: height || current.height };
          sizeFrame.request(() => commitTarget(popup, positioner, target));
        });
      });
    });
  }

  function syncCurrentSize(popup: HTMLElement, positioner: HTMLElement) {
    sizeFrame.cancel();
    measure(popup, positioner, (size) => {
      if (size.width && size.height) {
        prevSize = size;
        if (sizes.value.positioner === null) {
          commitTarget(popup, positioner, size);
        } else {
          sizes.value = { popup: 'auto', positioner: size };
        }
      }
    });
  }

  watch(open, (isOpen) => {
    if (isOpen) {
      return;
    }

    mutationFrame.cancel();
    resizeFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset(true);
  });

  watch(mounted, (isMounted) => {
    if (!isMounted) {
      prevSize = DEFAULT_SIZE;
    }
  });

  useDomEffect([popupElement], () => {
    const popup = popupElement.value;
    if (!popup || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      prevSize = {
        width: popup.offsetWidth,
        height: popup.offsetHeight,
      };
    });

    resizeObserver.observe(popup);

    return () => resizeObserver.disconnect();
  });

  useDomEffect([open, isActiveItem, popupElement, positionerElement], () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!open.value || !isActiveItem.value || !popup || !positioner) {
      return undefined;
    }

    function handleResize() {
      resizeFrame.cancel();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The guard above returns when `popup` or `positioner` is `null`, and a function declaration keeps no narrowing.
      resizeFrame.request(() => syncCurrentSize(popup!, positioner!));
    }

    const unsubscribe = addEventListener(ownerWindow(positioner), 'resize', handleResize);

    return () => {
      resizeFrame.cancel();
      unsubscribe();
    };
  });

  useDomEffect(
    [currentContentRef, popupElement, positionerElement, isActiveItem, transitionStatus],
    () => {
      const observedElement = currentContentRef.value;
      const popup = popupElement.value;
      const positioner = positionerElement.value;

      if (
        !observedElement ||
        !popup ||
        !positioner ||
        !isActiveItem.value ||
        typeof MutationObserver !== 'function'
      ) {
        return undefined;
      }

      const mutationObserver = new MutationObserver(() => {
        if (
          transitionStatus.value === 'starting' ||
          popup.hasAttribute(TransitionStatusDataAttributes.startingStyle)
        ) {
          syncCurrentSize(popup, positioner);
          return;
        }

        if (sizes.value.popup && sizes.value.popup !== 'auto') {
          handleInterruptedMutationResize(popup, positioner, {
            width: popup.offsetWidth || prevSize.width,
            height: popup.offsetHeight || prevSize.height,
          });
          return;
        }

        handleValueChange(popup, positioner, prevSize.width, prevSize.height);
      });

      mutationObserver.observe(observedElement, {
        childList: true,
        subtree: true,
        characterData: true,
        // A switch between kept contents changes their `hidden` attribute and adds or removes no
        // node.
        attributes: true,
        attributeFilter: ['hidden'],
      });

      return () => mutationObserver.disconnect();
    },
  );

  useDomEffect([isActiveItem, open, popupElement, positionerElement, transitionStatus], () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!isActiveItem.value || !open.value || !popup || !positioner) {
      return undefined;
    }

    const { width, height } = switchFrom ?? getCssDimensions(popup);
    switchFrom = undefined;
    handleValueChange(popup, positioner, width, height);
    return undefined;
  });
}
