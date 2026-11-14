import { computed } from 'vue';
import { REASONS } from '../../internals/reasons';
import { mergeProps } from '../../merge-props';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuFilterPopup } from './MenuFilterContext';
import { useMenuFilterPopup } from './useMenuFilterPopup';

/**
 * Gives the popup of a filterable menu the role `dialog`, which holds the input and the list, and
 * the listeners that keep the focus on the input. `Menu.Popup` calls it in `setup`.
 */
export function useFilterPopup(): MenuFilterPopup {
  const { store, orientation } = useMenuRootContext();

  const interactionProps = useMenuFilterPopup(orientation);

  const initialFocus = computed<FocusOption>(() => {
    const open = store.select('open');
    const openMethod = store.select('openMethod');
    const lastOpenChangeReason = store.select('lastOpenChangeReason');

    const openedByHover = open && lastOpenChangeReason === REASONS.triggerHover;
    const mayFocusInput =
      store.select('parent').type !== 'menu' ||
      (open &&
        (openMethod === 'keyboard' ||
          lastOpenChangeReason === REASONS.listNavigation ||
          lastOpenChangeReason === REASONS.triggerHover ||
          lastOpenChangeReason === REASONS.triggerPress));

    // The input holds real focus; the popup is never the focus target.
    if (!mayFocusInput) {
      return false;
    }

    return () => {
      // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
      // VoiceOver double-tap) still reports a touch and needs the input focused.
      const touchOpen =
        (openMethod === 'touch' || openMethod === 'pen') && !store.context.virtualPress;
      if (openedByHover || touchOpen) {
        return false;
      }
      return store.context.virtualFocusRef?.value ?? false;
    };
  });

  return {
    props: (attrs) => mergeProps<'div'>(interactionProps, attrs, { role: 'dialog' }),
    initialFocus,
  };
}
