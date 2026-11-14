<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { FilterDropdownInputState } from '../../filter-dropdown/input/FilterDropdownInput';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
interface MenuInputAutocomplete {
  autocomplete?: string | undefined;
}

export interface MenuInputState extends FilterDropdownInputState {}

export interface MenuInputProps
  extends
    VaseUIComponentProps<MenuInputState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<InputHTMLAttributes>,
      'autocomplete' | 'disabled' | 'id'
    >,
    /* @vue-ignore */ MenuInputAutocomplete {
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the input should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { useFilterDropdownInput } from '../../filter-dropdown/input/FilterDropdownInput';
import { useFilterDropdownValueContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { addEventListener } from '../../common/addEventListener';
import { ownerDocument } from '../../common/owner';
import { activeElement } from '../../common/shadowDom';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';
import { useMenuFilterKeyDown } from '../filter-root/useMenuFilterKeyDown';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuInputProps>(), { as: 'input' });

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, MenuInputState>;
}>();

useMenuFilterPart('Input');

const menuContext = useMenuRootContext();
const { store } = menuContext;
const value = useFilterDropdownValueContext();
const handleKeydown = useMenuFilterKeyDown(
  menuContext,
  () => value.value !== '',
  useMenuSubmenuRootContext(),
);

const input = useFilterDropdownInput({
  id: () => props.id,
  disabled: () => props.disabled,
  activeItemId: () => store.select('highlightedItemId'),
  // The input routes its own keys, so the navigation props hold no key handler.
  navigationProps: () => {
    const { onKeydown: _onKeydown, ...navigationProps } = store.select('inputProps');
    return navigationProps as HTMLProps;
  },
});

let stopListeningToFocus: (() => void) | undefined;

// A change of the element covers the removal of the input without a blur event. The input listens
// to the focus with the browser, because Vue skips a listener for an event that comes in the
// millisecond when Vue attached it, and a popup can move the focus to a new input in that
// millisecond.
function setInputFocused(element: HTMLInputElement | null) {
  stopListeningToFocus?.();
  stopListeningToFocus = undefined;
  store.set('inputFocused', element !== null && activeElement(ownerDocument(element)) === element);
  if (element === null) {
    return;
  }
  const stopFocusin = addEventListener(element, 'focusin', () => {
    store.set('inputFocused', true);
  });
  const stopFocusout = addEventListener(element, 'focusout', () => {
    store.set('inputFocused', false);
  });
  stopListeningToFocus = () => {
    stopFocusin();
    stopFocusout();
  };
}

const { element, elementProps } = useRenderElement('input', props, {
  state: input.state,
  ref: [input.ref, setInputFocused],
  props: (attrs) => input.props(mergeProps<'input'>({ onKeydown: handleKeydown }, attrs)),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="input.state.value" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
