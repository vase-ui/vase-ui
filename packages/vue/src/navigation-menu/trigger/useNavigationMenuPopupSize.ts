import { onActivated, onDeactivated, onMounted, onScopeDispose, watch } from 'vue';
import type { ComputedRef, WatchSource } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerWindow } from '../../common/owner';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import * as TransitionStatusDataAttributes from '../../internals/TransitionStatusDataAttributes';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import * as NavigationMenuPopupCssVars from '../popup/NavigationMenuPopupCssVars';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';

const DEFAULT_SIZE = { width: 0, height: 0 };

/**
 * Runs `effect` after the mount and after each DOM update that follows a change of `sources`. The
 * function that `effect` returns runs before the next run, at the unmount and while `KeepAlive`
 * holds the part.
 */
function watchAfterMount(
  sources: WatchSource[],
  effect: () => (() => void) | undefined,
) {
  let cleanup: (() => void) | undefined;
  let deactivated = false;

  function run() {
    cleanup?.();
    cleanup = deactivated ? undefined : effect();
  }

  onMounted(run);
  watch(sources, run, { flush: 'post' });
  onDeactivated(() => {
    deactivated = true;
    run();
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      run();
    }
  });
  onScopeDispose(() => cleanup?.());
}

/**
 * Gives the popup the size of the content of the active item. While the active item changes, the
 * popup has a fixed size, so that a CSS transition can run from the old size to the new size. When
 * the transitions end, the popup size goes back to `auto`.
 *
 * Call it in the `setup` of the trigger.
 */
export function useNavigationMenuPopupSize(
  itemValue: ComputedRef<any>,
  isActiveItem: ComputedRef<boolean>,
) {
  const {
    open,
    mounted,
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
  let skipAutoSizeSync = false;

  function cancelAutoSizeReset(force = false) {
    if (!force && popupAutoSizeResetRef.owner !== itemValue.value) {
      return;
    }

    popupAutoSizeResetRef.abortController?.abort();
    popupAutoSizeResetRef.abortController = null;
    popupAutoSizeResetRef.owner = null;
  }

  watch(isActiveItem, (isActive) => {
    if (isActive) {
      return;
    }

    mutationFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  });

  function setAutoSizes(element: HTMLElement) {
    element.style.setProperty(NavigationMenuPopupCssVars.popupWidth, 'auto');
    element.style.setProperty(NavigationMenuPopupCssVars.popupHeight, 'auto');
  }

  function clearFixedSizes(popup: HTMLElement, positioner: HTMLElement) {
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
  }

  function scheduleAutoSizeReset(popup: HTMLElement) {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    popupAutoSizeResetRef.abortController = abortController;
    popupAutoSizeResetRef.owner = itemValue.value;

    runOnceAnimationsFinish(() => {
      popupAutoSizeResetRef.abortController = null;
      popupAutoSizeResetRef.owner = null;
      setAutoSizes(popup);
    }, abortController.signal);
  }

  function handleValueChange(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);
    const measuredWidth = width || prevSize.width;
    const measuredHeight = height || prevSize.height;

    if (currentHeight === 0 || currentWidth === 0) {
      currentWidth = measuredWidth;
      currentHeight = measuredHeight;
    }

    popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
    popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${measuredWidth}px`);
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerHeight,
      `${measuredHeight}px`,
    );

    sizeFrame.request(() => {
      if (!isActiveItem.value) {
        return;
      }

      popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
      popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${measuredHeight}px`);

      scheduleAutoSizeReset(popup);
    });
  }

  function handleInterruptedMutationResize(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);

    if (currentWidth === 0 || currentHeight === 0) {
      return;
    }

    setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

    mutationFrame.request(() => {
      mutationFrame.request(() => {
        clearFixedSizes(popup, positioner);

        const { width, height } = getCssDimensions(popup);
        const measuredWidth = width || currentWidth;
        const measuredHeight = height || currentHeight;

        setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

        sizeFrame.request(() => {
          if (!isActiveItem.value) {
            return;
          }

          setSharedFixedSize(popup, positioner, measuredWidth, measuredHeight);
          scheduleAutoSizeReset(popup);
        });
      });
    });
  }

  function syncCurrentSize(popup: HTMLElement, positioner: HTMLElement) {
    sizeFrame.cancel();
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);

    if (width === 0 || height === 0) {
      return;
    }

    prevSize = { width, height };
    setAutoSizes(popup);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${width}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${height}px`);
  }

  function getMutationBaseline(popup: HTMLElement) {
    const popupWidth = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing =
      popupWidth !== '' && popupWidth !== 'auto' && popupHeight !== '' && popupHeight !== 'auto';

    if (!isResizing) {
      return { size: prevSize, syncPositioner: false };
    }

    return {
      size: {
        width: popup.offsetWidth || prevSize.width,
        height: popup.offsetHeight || prevSize.height,
      },
      syncPositioner: true,
    };
  }

  watch(open, (isOpen) => {
    if (isOpen) {
      return;
    }

    mutationFrame.cancel();
    resizeFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset(true);
    skipAutoSizeSync = false;
  });

  watch(mounted, (isMounted) => {
    if (!isMounted) {
      prevSize = DEFAULT_SIZE;
    }
  });

  watchAfterMount([popupElement], () => {
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

  watchAfterMount([open, isActiveItem, popupElement, positionerElement], () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!open.value || !isActiveItem.value || !popup || !positioner) {
      return undefined;
    }

    function handleResize() {
      resizeFrame.cancel();
      resizeFrame.request(() => syncCurrentSize(popup!, positioner!));
    }

    const unsubscribe = addEventListener(ownerWindow(positioner), 'resize', handleResize);

    return () => {
      resizeFrame.cancel();
      unsubscribe();
    };
  });

  watchAfterMount(
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

        const { size, syncPositioner } = getMutationBaseline(popup);

        if (syncPositioner) {
          handleInterruptedMutationResize(popup, positioner, size.width, size.height);
          return;
        }

        handleValueChange(popup, positioner, size.width, size.height);
      });

      mutationObserver.observe(observedElement, {
        childList: true,
        subtree: true,
        characterData: true,
        // `keepMounted` submenu switches update dimensions by toggling hidden
        // content rather than inserting or removing content nodes.
        attributes: true,
        attributeFilter: ['hidden'],
      });

      return () => mutationObserver.disconnect();
    },
  );

  watchAfterMount([open, popupElement, positionerElement, transitionStatus], () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!isActiveItem.value || !open.value || !popup || !positioner) {
      return undefined;
    }

    if (skipAutoSizeSync) {
      skipAutoSizeSync = false;
      return undefined;
    }

    const { width, height } = getCssDimensions(popup);
    handleValueChange(popup, positioner, width, height);
    return undefined;
  });

  return {
    handleValueChange,
    /**
     * Makes the next run of the size effect do nothing. A switch of the active item calls
     * `handleValueChange` itself.
     */
    skipNextAutoSizeSync() {
      skipAutoSizeSync = true;
    },
  };
}
