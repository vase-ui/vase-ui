<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../field/types';
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
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. The default is the id of `<Select.Root>`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value = any">
import { selectors as selectSelectors } from '../store';
import { triggerBindings } from '../../utils/popups/popupBindings';
import { computed, inject, onMounted, onScopeDispose, toRaw, watch } from 'vue';
import { ownerDocument } from '../../common/owner';
import { useTimeout } from '../../common/useTimeout';
import { contains, getTarget } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDeferredServerRender } from '../../common/deferredServerRender';
import { controlAria, describedByWith, fieldKey } from '../../field/control';
import {
  DEFAULT_FIELD_STATE_ATTRIBUTES,
  fieldValidityMapping,
} from '../../internals/field-constants';
import { given } from '../../internals/givenAttributes';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { REASONS } from '../../internals/reasons';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { isReleaseAtPressPoint } from '../../utils/popups/isReleaseAtPressPoint';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { useSelectRootOwner } from '../root/SelectRootContext';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';

defineOptions({ inheritAttrs: false });

const SELECTED_DELAY = 400;

const props = withDefaults(defineProps<SelectTriggerProps<Value>>(), {
  as: 'button',
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Select.Trigger');
}

defineSlots<{
  default(props: { state: SelectTriggerState<Value> }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectTriggerState<Value>>;
}>();

const field = inject(fieldKey, null);
// The trigger binds the id of a label and the ids of the messages of a field, which can come after
// it. `Select.Label` registers its id with the root, so the trigger defers also with no field.
useDeferredServerRender();
const { store, open: isOpen, requestOpen } = useSelectRootOwner();

const isDisabled = computed(
  () => Boolean(field?.disabled) || store.state.disabled || props.disabled,
);
const isReadOnly = computed(() => store.state.readOnly);
const hasSelectedValue = computed(() => selectSelectors.hasSelectedValue(store.state));
const popupSide = computed(() =>
  store.state.mounted && selectSelectors.positionerElement(store.state)
    ? store.state.popupSide
    : null,
);
const triggerId = computed(() => given('id', props.id) ?? store.state.id);
// The trigger names the list, or the popup while the popup holds no list. An element with no id has
// an empty `id`, and the trigger then has no `aria-controls`.
const ariaControls = computed(() => {
  if (!isOpen.value) {
    return undefined;
  }
  return store.state.listElement
    ? store.state.listElementId || undefined
    : selectSelectors.popupId(store.state);
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
  const press = store.context.triggerPressRef.value;
  store.context.triggerPressRef.value = null;

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

  if (press && isReleaseAtPressPoint(press, mouseEvent)) {
    return;
  }

  requestOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
}

onScopeDispose(removeMouseUpListener);

const focusTimeout = useTimeout();
const selectedDelayTimeout = useTimeout();
const { isHeld } = useKeepAliveState();

function syncMouseUpSelection() {
  if (isOpen.value) {
    if (isHeld.value) {
      return;
    }

    // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
    // disabled briefly so releasing over either the selected item or a neighboring item doesn't
    // commit an accidental selection. SelectItem can still opt into unselected mouseup sooner
    // after a real drag over the item.
    selectedDelayTimeout.start(SELECTED_DELAY, () => {
      store.context.selectionRef.value.allowUnselectedMouseUp = true;
      store.context.selectionRef.value.allowSelectedMouseUp = true;
    });
    return;
  }

  selectedDelayTimeout.clear();
  store.context.selectionRef.value = {
    allowSelectedMouseUp: false,
    allowUnselectedMouseUp: false,
    dragY: 0,
  };
}

onMounted(syncMouseUpSelection);
watch(isOpen, syncMouseUpSelection);
watch(
  isHeld,
  (held) => {
    if (!held) {
      syncMouseUpSelection();
      return;
    }

    removeMouseUpListener();
    focusTimeout.clear();
    selectedDelayTimeout.clear();
  },
  { flush: 'sync' },
);

const state = computed<SelectTriggerState<Value>>(() => ({
  ...(field?.state ?? DEFAULT_FIELD_STATE_ATTRIBUTES),
  open: isOpen.value,
  disabled: isDisabled.value,
  value: store.state.selectedValue,
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
    }),
  state,
  ref: setTriggerElement,
  stateAttributesMapping,
  props: (attrs) => [
    triggerBindings(store, true),
    field ? controlAria(field) : {},
    {
      id: triggerId.value,
      role: 'combobox',
      'aria-expanded': isOpen.value,
      'aria-haspopup': 'listbox',
      'aria-controls': ariaControls.value,
      'aria-labelledby': resolveAriaLabelledBy(field?.labelId, store.context.labelId.value),
      'aria-readonly': isReadOnly.value || undefined,
      'aria-required': store.state.required || undefined,
      tabindex: isDisabled.value ? -1 : 0,
      onFocusin(event: FocusEvent) {
        // The popup element shouldn't obscure the focused trigger.
        if (isOpen.value && store.context.alignItemWithTriggerActiveRef.value) {
          requestOpen(false, createChangeEventDetails(REASONS.none, event));
        }

        // Saves a re-render on initial click: `forceMounted === true` mounts
        // the items before `open === true`. We could sync those cycles better
        // without a timeout, but this is enough for now.
        focusTimeout.start(0, () => {
          store.set('forceMounted', true);
        });
      },
      onFocusout(event: FocusEvent) {
        // If focus is moving into the popup, don't count it as a blur.
        if (contains(toRaw(store.state).positionerElement, event.relatedTarget as Element | null)) {
          return;
        }

        field?.onLeave(event.currentTarget as Element);
      },
      onMousedown(event: MouseEvent) {
        if (isOpen.value) {
          return;
        }

        removeMouseUpListener();
        mouseUpDocument = ownerDocument(event.currentTarget as Element);
        store.context.triggerPressRef.value = event;
        mouseUpDocument.addEventListener('mouseup', handleMouseUp, { once: true });
      },
    },
    attrs,
    field ? { 'aria-describedby': describedByWith(field, attrs['aria-describedby']) } : undefined,
    (merged) => ({ ...merged, role: 'combobox' }),
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
