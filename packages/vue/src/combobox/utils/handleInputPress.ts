import { isElement } from '@floating-ui/utils/dom';
import { contains, getTarget } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { MaybeVaseUIEvent } from '../../internals/types';
import { REASONS } from '../../internals/reasons';
import { isInteractiveElement } from '../../utils/popups/element';
import type { ComboboxStore } from '../store';

export function handleInputPress(
  event: MaybeVaseUIEvent<MouseEvent>,
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: (target: Element | null) => boolean,
) {
  if (event.vaseUIHandlerPrevented) {
    return;
  }

  const target = getTarget(event);
  const targetElement = isElement(target) ? target : null;
  const currentTarget = event.currentTarget as Element;

  if (targetElement && !contains(currentTarget, targetElement)) {
    return;
  }

  if (
    targetElement !== currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.context.inputRef.value?.focus();

  if (store.state.openOnInputClick) {
    store.setOpen(true, createChangeEventDetails(REASONS.inputPress, event));
  }
}
