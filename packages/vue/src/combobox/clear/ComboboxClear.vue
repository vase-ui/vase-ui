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
import { computed, inject } from 'vue';
import type { Component } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { fieldKey } from '../../field/control';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { REASONS } from '../../internals/reasons';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
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

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Combobox.Clear');
}

defineSlots<{
  /**
   * The content of the button. The default is `x`.
   */
  default(props: { state: ComboboxClearState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxClearState; children: Component }): unknown;
}>();

const field = inject(fieldKey, null);
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

const isDisabled = computed(() =>
  Boolean(field?.disabled || store.select('disabled') || props.disabled),
);

// The element is in the DOM until the exit animation ends.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  visible,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<ComboboxClearState>(() => ({
  disabled: isDisabled.value,
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
  if (isDisabled.value || store.select('readOnly')) {
    return;
  }

  const type = getHighlightReason(event);

  store.context.setInputValue('', createChangeEventDetails(REASONS.clearPress, event));

  if (selectionMode.value !== 'none') {
    // A press can come while the value is empty: during the exit of the button, or with
    // `keepMounted`. The root emits no change for an empty value (`VUE-91`). The call would also
    // ask again to clear text that an `inputValueChange` listener kept.
    if (store.select('hasSelectedValue')) {
      store.context.setSelectedValue(
        Array.isArray(store.select('selectedValue')) ? [] : null,
        createChangeEventDetails(REASONS.clearPress, event),
      );
    }
    store.context.setIndices({ activeIndex: null, selectedIndex: null, type, event });
  } else {
    store.context.setIndices({ activeIndex: null, type, event });
  }

  store.context.inputRef.value?.focus();
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      native: () => props.nativeButton,
      disabled: isDisabled,
    }),
  state,
  ref: setClearElement,
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
  ],
  stateAttributesMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="(keepMounted || mounted) && usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ComboboxClearChildren" />
  <component :is="as" v-else-if="keepMounted || mounted" v-bind="elementProps()" :ref="setRef">
    <ComboboxClearChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ComboboxClearChildren>
  </component>
</template>
