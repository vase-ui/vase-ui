<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the clear button should be visible.
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ComboboxClearState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useFieldRootContext } from '../../internals/field-root-context';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { REASONS } from '../../internals/reasons';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import {
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import ComboboxClearChildren from './ComboboxClearChildren.vue';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<ComboboxClearState> = {
  ...transitionStatusMapping,
  ...triggerOpenStateMapping,
};

const props = withDefaults(defineProps<ComboboxClearProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
  keepMounted: false,
});

defineSlots<{
  /**
   * The content of the button. The default is `x`.
   */
  default(props: { state: ComboboxClearState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxClearState; children: Component }): unknown;
}>();

const { disabled: fieldDisabled } = useFieldRootContext();
const store = useComboboxRootContext();
const inputValue = useComboboxInputValueContext();

const selectionMode = computed(() => store.select('selectionMode'));

const visible = computed(() => {
  if (selectionMode.value === 'none') {
    return inputValue.value !== '';
  }
  if (selectionMode.value === 'single') {
    return store.select('selectedValue') != null;
  }
  return store.select('hasSelectionChips');
});

const disabled = computed(() =>
  Boolean(fieldDisabled.value || store.select('disabled') || props.disabled),
);

const { buttonRef, getButtonProps } = useButton({
  native: () => props.nativeButton,
  disabled,
});

// The element is in the DOM until the exit animation ends.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  visible,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<ComboboxClearState>(() => ({
  disabled: disabled.value,
  visible: visible.value,
  open: store.select('open'),
  transitionStatus: transitionStatus.value,
}));

useOpenChangeComplete({
  open: visible,
  ref: store.context.clearRef,
  onComplete() {
    if (!visible.value) {
      setMounted(false);
    }
  },
});

// A template can mount the button that replaces this button before it unmounts this button. The
// button then clears the element of the root only when the root holds its own element.
let ownButton: HTMLButtonElement | null = null;
function setClearElement(element: HTMLElement | null) {
  const button = element as HTMLButtonElement | null;
  if (button !== null || store.context.clearRef.value === ownButton) {
    store.context.clearRef.value = button;
  }
  ownButton = button;
}

function handleClick(event: MouseEvent) {
  if (disabled.value || store.select('readOnly')) {
    return;
  }

  const type = getHighlightReason(event);

  store.context.setInputValue('', createChangeEventDetails(REASONS.clearPress, event));

  if (selectionMode.value !== 'none') {
    store.context.setSelectedValue(
      Array.isArray(store.select('selectedValue')) ? [] : null,
      createChangeEventDetails(REASONS.clearPress, event),
    );
    store.context.setIndices({ activeIndex: null, selectedIndex: null, type, event });
  } else {
    store.context.setIndices({ activeIndex: null, type, event });
  }

  store.context.inputRef.value?.focus();
}

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [buttonRef, setClearElement],
  props: (attrs) => [
    {
      tabindex: -1,
      // Avoid stealing focus from the input.
      onMousedown(event: MouseEvent) {
        event.preventDefault();
      },
      onClick: handleClick,
    },
    attrs,
    getButtonProps,
  ],
  stateAttributesMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ComboboxClearChildren" />
    <component :is="as" v-else v-bind="elementProps()"><ComboboxClearChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ComboboxClearChildren></component>
  </template>
</template>
