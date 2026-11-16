<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  FieldRootState,
  FieldValidityData,
} from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps
  extends
    VaseUIComponentProps<FieldErrorState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The `id` of the message. The control of the field names it in `aria-describedby`.
   */
  id?: string | undefined;
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof FieldValidityData['state'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRegisteredMessageId } from '../../internals/labelable-provider';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import FieldErrorChildren from './FieldErrorChildren.vue';
import { FieldErrorContext } from './FieldErrorContext';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

const props = withDefaults(defineProps<FieldErrorProps>(), { as: 'div', match: undefined });

defineSlots<{
  default(props: { state: FieldErrorState }): unknown;
  render(props: { props: HTMLProps; state: FieldErrorState; children: Component }): unknown;
}>();

const errorId = useVaseUiId(() => props.id);

const { validityData, state: fieldState, name } = useFieldRootContext(false);
const { errors } = useFormContext();

const formError = computed(() => {
  const fieldName = name.value;
  return fieldName && Object.hasOwn(errors.value, fieldName) ? errors.value[fieldName] : null;
});
const hasFormError = computed(
  () => !!(Array.isArray(formError.value) ? formError.value.length : formError.value),
);
const hasSpecificMatch = computed(() => typeof props.match === 'string');

const rendered = computed(() => {
  if (props.match === true) {
    return true;
  }
  if (fieldState.value.disabled) {
    return false;
  }
  if (typeof props.match === 'string') {
    return Boolean(validityData.value.state[props.match]);
  }
  return hasFormError.value || validityData.value.state.valid === false;
});

// The element is in the DOM until the exit animation ends.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  rendered,
  false,
  false,
  false,
  () => element.value,
);

useRegisteredMessageId(() => (rendered.value ? errorId.value : undefined));

const error = computed<string | string[] | null | undefined>(() => {
  if (!hasSpecificMatch.value && hasFormError.value) {
    return formError.value;
  }
  if (validityData.value.errors.length > 1) {
    return validityData.value.errors;
  }
  return validityData.value.error;
});

const errorMessage = computed(() => {
  const message = error.value;
  if (Array.isArray(message)) {
    return message.length > 1 ? message : message[0];
  }
  return message;
});

// The message of the last time that the error showed. The element keeps it while it animates out,
// after the field is valid again. The watcher is sync, so the message does not change in the
// render that follows the write that hides the error.
const lastRenderedMessage = shallowRef<string | string[] | null | undefined>(null);
watch(
  [rendered, errorMessage],
  () => {
    if (rendered.value) {
      lastRenderedMessage.value = errorMessage.value;
    }
  },
  { immediate: true, flush: 'sync' },
);

provide(
  FieldErrorContext,
  computed(() => (rendered.value ? errorMessage.value : lastRenderedMessage.value)),
);

const state = computed<FieldErrorState>(() => ({
  ...fieldState.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ id: errorId.value }, attrs],
  stateAttributesMapping,
  children: true,
});

useOpenChangeComplete({
  open: rendered,
  ref: element,
  onComplete() {
    if (!rendered.value) {
      setMounted(false);
    }
  },
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="FieldErrorChildren" />
    <component :is="as" v-else v-bind="elementProps()"><FieldErrorChildren><template v-if="$slots.default" #default><slot :state="state" /></template></FieldErrorChildren></component>
  </template>
</template>
