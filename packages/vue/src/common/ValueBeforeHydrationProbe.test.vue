<script setup lang="ts">
import { defineComponent, h, shallowRef, useTemplateRef } from 'vue';
import { useValueBeforeHydration } from './hydration';

const props = withDefaults(
  defineProps<{
    as?: string | undefined;
    type?: string | undefined;
    value?: string | undefined;
    // The model keeps its value for each event.
    refuses?: boolean | undefined;
    // The part calls the composable two times for its element.
    callsTwice?: boolean | undefined;
    // The part renders `ValueText` in `as`.
    rendersComponent?: boolean | undefined;
  }>(),
  { as: 'input' },
);

// A component that declares `value` and renders it.
const ValueText = defineComponent({
  props: { value: { type: String, default: undefined } },
  setup(textProps) {
    return () => h('output', textProps.value ?? '');
  },
});

const tag = props.rendersComponent ? ValueText : props.as;
const control = shallowRef<Element | null>(null);
const writesValue = useValueBeforeHydration({ as: tag }, () => control.value);
const writesValueAgain = props.callsTwice
  ? useValueBeforeHydration({ as: tag }, () => control.value)
  : writesValue;

const model = shallowRef(props.value ?? '');
const events = shallowRef<string[]>([]);
const modelOutput = useTemplateRef<HTMLOutputElement>('modelOutput');

function setControl(element: unknown) {
  control.value = element instanceof Element ? element : null;
}

function record(entry: string) {
  events.value = [...events.value, entry];
}

function handleInput(event: Event) {
  record(writesValue.value ? 'input' : 'input of the take');
  if (!props.refuses) {
    model.value = (event.currentTarget as HTMLInputElement).value;
  }
}

// The model text shows whether the flush of the `input` event came before the event.
function recordFocusEvent(event: FocusEvent) {
  const related = event.relatedTarget as Element | null;
  record(
    `${event.type} to ${related?.localName ?? 'null'}, model ${modelOutput.value?.textContent ?? ''}`,
  );
}
</script>

<template>
  <component
    :is="tag"
    :ref="setControl"
    :type="type"
    v-bind="writesValue && writesValueAgain ? { value: model } : undefined"
    data-testid="control"
    @input="handleInput"
    @change="record('change')"
    @blur="recordFocusEvent"
    @focusout="recordFocusEvent"
  />
  <button type="button" data-testid="outside">Outside</button>
  <output ref="modelOutput" data-testid="model">{{ model }}</output>
  <output data-testid="events">{{ events.join('; ') }}</output>
</template>
