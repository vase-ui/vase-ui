<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { Side } from '../../internals/useAnchorPositioning';

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ComboboxTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. While the input is inside the popup, the default is the id of
   * `<Combobox.Root>`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onDeactivated, onScopeDispose, toRaw } from 'vue';
import { isElementDisabled } from '../../common/isElementDisabled';
import { ownerDocument } from '../../common/owner';
import { contains, getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import {
  useDeferredServerRender,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { stopEvent } from '../../utils/popups/event';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useTypeahead } from '../../utils/popups/interactions/useTypeahead';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { getComboboxPopupId } from '../root/utils';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxTriggerProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: ComboboxTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxTriggerState>;
}>();

const {
  state: fieldState,
  disabled: fieldDisabled,
  setTouched,
  validationMode,
  validation,
} = useFieldRootContext();
const { labelId: fieldLabelId } = useLabelableContext();
// The trigger binds the id of a label and the ids of the messages of a field, which can come after
// it. `Combobox.Label` registers its id with the root, so the trigger defers also with no field.
useDeferredServerRender();
const store = useComboboxRootContext();
const inputValue = useComboboxInputValueContext();

const selectionMode = computed(() => store.select('selectionMode'));
const comboboxDisabled = computed(() => store.select('disabled'));
const isReadOnly = computed(() => store.select('readOnly'));
const isOpen = computed(() => store.select('open'));
const inputInsidePopup = computed(() => store.select('inputInsidePopup'));
const hasSelectedValue = computed(() => store.select('hasSelectedValue'));
const isDisabled = computed(
  () => Boolean(fieldDisabled.value) || comboboxDisabled.value || props.disabled,
);
const listEmpty = useListEmpty();
const popupSide = usePopupSide(store);

const setFocused = useSetFieldFocused(isDisabled, () => element.value);

useLabelableId({ id: () => (inputInsidePopup.value ? props.id : undefined) });
const triggerId = computed(() =>
  inputInsidePopup.value ? (props.id ?? store.select('id')) : props.id,
);

const ariaControls = computed(() => {
  if (isOpen.value && inputInsidePopup.value) {
    // Fall back to the default id while the popup registers its own (custom ids are stored once the
    // popup mounts), so `aria-controls` is set on the same commit `open` becomes `true`.
    return store.select('popupElementId') ?? getComboboxPopupId(store.select('id'));
  }
  return isOpen.value ? store.select('listElement')?.id : undefined;
});

let currentPointerType = '';

function trackPointerType(event: PointerEvent) {
  currentPointerType = event.pointerType;
}

const typeahead = useTypeahead(store.interactions, {
  // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
  // gated on `readOnly`.
  enabled: () =>
    !isOpen.value &&
    !isReadOnly.value &&
    !comboboxDisabled.value &&
    selectionMode.value === 'single',
  listRef: store.context.labelsRef,
  activeIndex: () => store.select('activeIndex'),
  selectedIndex: () => store.select('selectedIndex'),
  // A click never selects a disabled item, so typeahead skips it too. Only a mounted item has a
  // disabled state: the labels of `items` exist while no item is mounted.
  disabledIndices: (index) => {
    const item = store.context.listRef.value[index];
    return item != null && isElementDisabled(item);
  },
  onMatch(index) {
    const nextSelectedValue = store.context.valuesRef.value[index];
    if (nextSelectedValue !== undefined) {
      store.context.setSelectedValue(nextSelectedValue, createChangeEventDetails(REASONS.none));
    }
  },
});

const click = useClick(store.interactions, {
  enabled: () => !comboboxDisabled.value,
  event: 'mousedown',
  // A Combobox never opens on hover or focus, so a press always toggles it, even when a key
  // press, such as typing or an arrow key, opened it.
  stickIfOpen: false,
});

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

const focusTimeout = useTimeout();

// The cleanup also runs on a server, so it removes the listener only from the document that got it.
let mouseUpDocument: Document | null = null;

function removeMouseUpListener() {
  mouseUpDocument?.removeEventListener('mouseup', handleMouseUp);
  mouseUpDocument = null;
}

function handleMouseUp(mouseEvent: MouseEvent) {
  const { triggerElement, positionerElement, listElement } = toRaw(store.state);
  if (!triggerElement) {
    return;
  }

  const mouseUpTarget = getTarget(mouseEvent) as Element | null;

  if (
    contains(triggerElement, mouseUpTarget) ||
    contains(positionerElement, mouseUpTarget) ||
    contains(listElement, mouseUpTarget)
  ) {
    return;
  }

  if (isMouseWithinBounds(mouseEvent, triggerElement)) {
    return;
  }

  store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
}

onScopeDispose(removeMouseUpListener);

onDeactivated(() => {
  removeMouseUpListener();
  focusTimeout.clear();
});

const state = computed<ComboboxTriggerState>(() => ({
  ...fieldState.value,
  readOnly: isReadOnly.value,
  open: isOpen.value,
  disabled: isDisabled.value,
  popupSide: popupSide.value,
  listEmpty: listEmpty.value,
  placeholder: selectionMode.value === 'none' ? false : !hasSelectedValue.value,
}));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [buttonRef, setTriggerElement],
  stateAttributesMapping: triggerStateAttributesMapping,
  props: (attrs) => [
    store.select('triggerProps', true),
    click.reference,
    typeahead.reference,
    {
      id: triggerId.value,
      tabindex: inputInsidePopup.value ? 0 : -1,
      role: inputInsidePopup.value ? 'combobox' : undefined,
      'aria-expanded': isOpen.value,
      'aria-haspopup': inputInsidePopup.value ? 'dialog' : 'listbox',
      'aria-controls': ariaControls.value,
      'aria-required': inputInsidePopup.value ? store.select('required') || undefined : undefined,
      // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
      // the `Combobox.Input` outside the popup already carries `aria-readonly`.
      'aria-readonly': inputInsidePopup.value ? isReadOnly.value || undefined : undefined,
      'aria-labelledby': resolveAriaLabelledBy(fieldLabelId.value, store.context.labelId.value),
      onPointerdown: trackPointerType,
      onPointerenter: trackPointerType,
      onFocusin() {
        setFocused(true);

        if (isDisabled.value) {
          return;
        }

        focusTimeout.start(0, () => store.context.forceMount());
      },
      onFocusout(event: FocusEvent) {
        // If focus is moving into the popup, don't count it as a blur.
        if (contains(toRaw(store.state).positionerElement, event.relatedTarget as Element | null)) {
          return;
        }

        setTouched(true);
        setFocused(false);

        // A combobox that the user leaves with no value is not marked dirty. With a selection mode,
        // the trigger is a select, so the field counts `valueMissing` with no mark (BUG-1425).
        if (validationMode.value === 'onBlur') {
          const selectsValues = selectionMode.value !== 'none';
          void validation.commit(
            selectsValues ? toRaw(store.state).selectedValue : inputValue.value,
            selectsValues,
          );
        }
      },
      onMousedown(event: MouseEvent) {
        if (isDisabled.value) {
          return;
        }

        const trigger = event.currentTarget as HTMLElement;

        if (!inputInsidePopup.value) {
          store.interactions.set('anchorElement', trigger);
        }

        // Ensure items are registered for initial selection highlight.
        store.context.forceMount();

        if (currentPointerType !== 'touch') {
          store.context.inputRef.value?.focus();

          if (!inputInsidePopup.value) {
            event.preventDefault();
          }
        }

        if (isOpen.value || !inputInsidePopup.value) {
          return;
        }

        removeMouseUpListener();
        mouseUpDocument = ownerDocument(trigger);
        mouseUpDocument.addEventListener('mouseup', handleMouseUp, { once: true });
      },
      onKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          stopEvent(event);
          store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
          store.context.inputRef.value?.focus();
        }
      },
    },
    attrs,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
