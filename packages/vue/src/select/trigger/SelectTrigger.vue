<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { Side } from '../../internals/useAnchorPositioning';

export interface SelectTriggerState<Value = any> extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: Value;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerProps<Value = any>
  extends
    NativeButtonProps,
    VaseUIComponentProps<SelectTriggerState<Value>>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. The default is the id of `<Select.Root>`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value = any">
import { computed, onDeactivated, onScopeDispose, toRaw } from 'vue';
import { ownerDocument } from '../../common/owner';
import { contains, getTarget } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import {
  useDeferredServerRender,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { REASONS } from '../../internals/reasons';
import { useRenderElement } from '../../internals/useRenderElement';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { getFloatingFocusElement } from '../../utils/popups/element';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { useSelectRootContext } from '../root/SelectRootContext';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectTriggerProps<Value>>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: SelectTriggerState<Value> }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectTriggerState<Value>>;
}>();

const {
  setTouched,
  validationMode,
  validation,
  state: fieldState,
  disabled: fieldDisabled,
} = useFieldRootContext();
const { labelId: fieldLabelId } = useLabelableContext();
// The trigger binds the id of a label and the ids of the messages of a field, which can come after
// it. `Select.Label` registers its id with the root, so the trigger defers also with no field.
useDeferredServerRender();
const store = useSelectRootContext();

const isDisabled = computed(
  () => Boolean(fieldDisabled.value) || store.select('disabled') || props.disabled,
);
const isOpen = computed(() => store.select('open'));
const isReadOnly = computed(() => store.select('readOnly'));
const hasSelectedValue = computed(() => store.select('hasSelectedValue'));
const popupSide = computed(() =>
  store.select('mounted') && store.select('positionerElement') ? store.select('popupSide') : null,
);
const triggerId = computed(() => props.id ?? store.select('id'));
const ariaControls = computed(() =>
  isOpen.value
    ? (store.select('listElement')?.id ??
      getFloatingFocusElement(store.select('positionerElement'))?.id)
    : undefined,
);

useLabelableId({ id: () => props.id });

const setFocused = useSetFieldFocused(isDisabled, () => element.value);

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

// A compiled template can mount a new trigger before it unmounts the trigger that it replaces.
// The old trigger then clears only its own element.
let ownElement: HTMLElement | null = null;
function setTriggerElement(trigger: HTMLElement | null) {
  const previous = ownElement;
  ownElement = trigger;
  if (trigger) {
    store.set('triggerElement', trigger);
  } else if (toRaw(store.state).triggerElement === previous) {
    store.set('triggerElement', null);
  }
}

// The cleanup also runs on a server, so it removes the listener only from the document that got it.
let mouseUpDocument: Document | null = null;

function removeMouseUpListener() {
  mouseUpDocument?.removeEventListener('mouseup', handleMouseUp);
  mouseUpDocument = null;
}

function handleMouseUp(mouseEvent: MouseEvent) {
  const trigger = element.value;
  if (!trigger) {
    return;
  }

  const mouseUpTarget = getTarget(mouseEvent) as Element | null;

  // Don't treat the release as an outside press when it lands on the trigger or inside
  // the popup positioner (or their children).
  if (
    contains(trigger, mouseUpTarget) ||
    contains(toRaw(store.state).positionerElement, mouseUpTarget)
  ) {
    return;
  }

  if (isMouseWithinBounds(mouseEvent, trigger)) {
    return;
  }

  store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
}

onScopeDispose(removeMouseUpListener);
onDeactivated(removeMouseUpListener);

const state = computed<SelectTriggerState<Value>>(() => ({
  ...fieldState.value,
  open: isOpen.value,
  disabled: isDisabled.value,
  value: store.select('selectedValue'),
  readOnly: isReadOnly.value,
  popupSide: popupSide.value,
  placeholder: !hasSelectedValue.value,
}));

const stateAttributesMapping: StateAttributesMapping<SelectTriggerState<Value>> = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [SelectTriggerDataAttributes.popupSide]: side } : null,
  value: () => null,
};

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [buttonRef, setTriggerElement],
  stateAttributesMapping,
  props: (attrs) => [
    store.select('triggerProps', true),
    {
      id: triggerId.value,
      role: 'combobox',
      'aria-expanded': isOpen.value,
      'aria-haspopup': 'listbox',
      'aria-controls': ariaControls.value,
      'aria-labelledby': resolveAriaLabelledBy(fieldLabelId.value, store.context.labelId.value),
      'aria-readonly': isReadOnly.value || undefined,
      'aria-required': store.select('required') || undefined,
      tabindex: isDisabled.value ? -1 : 0,
      onFocusin() {
        setFocused(true);
      },
      onFocusout(event: FocusEvent) {
        // If focus is moving into the popup, don't count it as a blur.
        if (contains(toRaw(store.state).positionerElement, event.relatedTarget as Element | null)) {
          return;
        }

        setTouched(true);
        setFocused(false);

        if (validationMode.value === 'onBlur') {
          void validation.commit(toRaw(store.state).selectedValue);
        }
      },
      onMousedown(event: MouseEvent) {
        if (isOpen.value) {
          return;
        }

        removeMouseUpListener();
        mouseUpDocument = ownerDocument(event.currentTarget as Element);
        mouseUpDocument.addEventListener('mouseup', handleMouseUp, { once: true });
      },
    },
    attrs,
    getButtonProps,
    // `getButtonProps` gives an element that is not a native button the role `button`.
    (merged) => ({ ...validation.getValidationProps(isDisabled.value, merged), role: 'combobox' }),
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
