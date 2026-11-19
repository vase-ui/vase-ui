import {
  computed,
  onBeforeUnmount,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  triggerRef,
  unref,
  watch,
  watchPostEffect,
} from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { ownerWindow } from '../../../common/owner';
import { useControlled } from '../../../common/useControlled';
import { useFieldsetDisabled } from '../../../fieldset/root/useFieldsetDisabled';
import { usePopoverRootContext } from '../../../popover/root/PopoverRootContext';
import type { FocusOption } from '../../../utils/popups/focus/usePopupFocus';
import { createDefaultInitialFocus } from '../../../utils/popups/popupBindings';
import type { InteractionType } from '../../../utils/popups/usePopupTrigger';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../createVaseUIEventDetails';
import { useFieldRootContext } from '../../field-root-context';
import { observeRootNode } from '../../observeRootNode';
import { REASONS } from '../../reasons';
import { useFormReset } from '../../useFormReset';
import { useKeepAliveState } from '../../useKeepAliveState';
import { PickerResetCountContext } from '../field/PickerResetCountContext';
import { RegisterPickerFocusTarget } from './PickerControlContext';
import type { PickerFocusTarget } from './PickerControlContext';
import { usePickerPopup } from './usePickerPopup';

export interface DateTimePickerContext<Value, Template, Details> {
  value: ComputedRef<Value>;
  template: ComputedRef<Template>;
  commit: (value: Value, details: Details) => void;
  reset: (details: Details) => void;
  closeOnSelect: ComputedRef<boolean>;
  fields: PickerPartElements;
  triggers: PickerPartElements;
  disabled: ComputedRef<boolean>;
}

interface PickerProps<Value> {
  modelValue?: Value | null | undefined;
  defaultValue?: Value | null | undefined;
  closeOnSelect?: boolean | undefined;
  disabled?: boolean | undefined;
}

interface PickerPolicy<Value, Template, Details> {
  name: string;
  empty: Value;
  templateOf: (value: NonNullable<Value>) => Template | null;
  fallback: MaybeRefOrGetter<Template>;
  hasTime?: (template: Template) => boolean;
  valueChange: (value: Value, details: Details) => void;
  updateValue: (value: Value) => void;
}

export function useDateTimePickerRoot<
  Value,
  Template,
  Details extends { isCanceled: boolean; event: Event },
>(
  props: Readonly<PickerProps<Value>>,
  policy: PickerPolicy<Value, Template, Details>,
): DateTimePickerContext<Value, Template, Details> {
  const defaultValue = () => props.defaultValue ?? policy.empty;
  const value = useControlled<Value>({
    controlled: () => (props.modelValue === null ? policy.empty : props.modelValue),
    default: defaultValue,
    name: policy.name,
  });

  function templateOf(candidate: Value | null | undefined) {
    return candidate == null ? null : policy.templateOf(candidate);
  }

  // A value can change and clear in one task. Its last kind still applies to the next edit.
  const lastTemplate = shallowRef<Template>();
  watch(
    value,
    (current) => {
      const next = templateOf(current);
      if (next != null) {
        lastTemplate.value = next;
      }
    },
    { immediate: true, flush: 'sync' },
  );

  const template = computed(
    () =>
      templateOf(value.value) ??
      templateOf(props.defaultValue) ??
      lastTemplate.value ??
      toValue(policy.fallback),
  );

  function commit(next: Value, details: Details) {
    policy.valueChange(next, details);
    if (!details.isCanceled) {
      policy.updateValue(next);
      value.value = next;
    }
  }

  const resetCount = shallowRef(0);
  provide(PickerResetCountContext, resetCount);
  const handledResets = new WeakSet<Event>();
  function reset(details: Details) {
    // Each field can receive the same native reset.
    if (props.modelValue === undefined && !handledResets.has(details.event)) {
      handledResets.add(details.event);
      resetCount.value += 1;
      commit(defaultValue(), details);
    }
  }

  const closeOnSelect = computed(() => props.closeOnSelect ?? !policy.hasTime?.(template.value));
  const fields = createPickerPartElements();
  const triggers = createPickerPartElements();
  const field = useFieldRootContext();
  const fieldsetDisabled = useFieldsetDisabled(() => fields.first.value ?? triggers.first.value);
  const disabled = computed(
    () => props.disabled === true || field.disabled.value === true || fieldsetDisabled.value,
  );

  return { value, template, commit, reset, closeOnSelect, fields, triggers, disabled };
}

export interface PickerPartElements {
  first: ComputedRef<HTMLElement | null>;
  add: (element: () => HTMLElement | null) => () => void;
}

export function createPickerPartElements(): PickerPartElements {
  const getters = shallowRef<(() => HTMLElement | null)[]>([]);
  const elements = computed(() => getters.value.map((get) => get()).filter((el) => el !== null));
  const readFirst = () => getFirstInDocument(elements.value) ?? elements.value[0] ?? null;
  const first = computed(readFirst);

  watchPostEffect((onCleanup) => {
    if (elements.value.length < 2) {
      return;
    }
    // A keyed move can change DOM order without replacing any part's ref.
    function checkOrder() {
      if (first.value !== readFirst()) {
        triggerRef(getters);
      }
    }
    checkOrder();
    for (const element of elements.value) {
      onCleanup(observeRootNode(element, checkOrder));
    }
  });

  function add(element: () => HTMLElement | null) {
    getters.value = [...getters.value, element];
    return () => {
      getters.value = getters.value.filter((get) => get !== element);
    };
  }

  return { first, add };
}

export function usePickerPartElement(
  parts: PickerPartElements,
  element: MaybeRefOrGetter<HTMLElement | null>,
): void {
  const { isHeld } = useKeepAliveState();
  // A leave transition can keep the element in the document after the part unmounts.
  onBeforeUnmount(parts.add(() => (isHeld.value ? null : toValue(element))));
}

function getFirstInDocument<T extends Element>(elements: (T | null | undefined)[]): T | undefined {
  let first: T | undefined;
  for (const element of elements) {
    if (
      element?.isConnected &&
      (!first ||
        first.compareDocumentPosition(element) &
          ownerWindow(first).Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      first = element;
    }
  }
  return first;
}

export function usePickerInitialFocus(
  initialFocus: () => FocusOption | undefined,
): ComputedRef<FocusOption> {
  const { popup } = usePopoverRootContext();
  const targets = new Set<PickerFocusTarget>();
  provide(RegisterPickerFocusTarget, (target) => {
    const { isHeld } = useKeepAliveState();
    const getElement = () => (isHeld.value ? null : target());
    targets.add(getElement);
    onScopeDispose(() => targets.delete(getElement));
  });

  const popupDefault = createDefaultInitialFocus(popup);
  const pickerDefault = (interactionType: InteractionType) =>
    getFirstInDocument(Array.from(targets, (target) => target())) ?? popupDefault(interactionType);

  return computed(() => {
    const option = initialFocus();
    if (typeof option === 'function') {
      return (interactionType: InteractionType) => {
        const result = option(interactionType);
        return result === true || result === null ? pickerDefault(interactionType) : result;
      };
    }
    const value = unref(option);
    return value === undefined || value === null || value === true ? pickerDefault : value;
  });
}

export interface PickerFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

interface PickerFieldOwner {
  disabled: ComputedRef<boolean>;
  props: { readOnly?: boolean | undefined };
  reset: (details: VaseUIChangeEventDetails<typeof REASONS.none>) => void;
}

export function usePickerField(
  field: Readonly<Ref<PickerFieldActions | null>>,
  fields: PickerPartElements,
  picker: PickerFieldOwner,
) {
  const element = computed(() => field.value?.element ?? null);
  const inputElement = computed(() => field.value?.inputElement ?? null);
  const { openByKey } = usePickerPopup();

  usePickerPartElement(fields, element);
  useFormReset(inputElement, (event) =>
    picker.reset(createChangeEventDetails(REASONS.none, event)),
  );

  function onKeydown(event: KeyboardEvent) {
    if (
      event.altKey &&
      event.key === 'ArrowDown' &&
      !event.defaultPrevented &&
      !event.isComposing &&
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- WebKit can report 229 on the last key of a composition.
      event.keyCode !== 229 &&
      !picker.disabled.value &&
      !picker.props.readOnly
    ) {
      event.preventDefault();
      openByKey(event);
    }
  }

  return { element, inputElement, fieldHandlers: { onKeydown } };
}
