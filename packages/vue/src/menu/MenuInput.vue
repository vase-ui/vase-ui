<script setup lang="ts">
import { computed, mergeProps, onUnmounted, shallowRef, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectFilter } from './filter';
import { injectMenu } from './root';
import type { MenuInputProps, MenuInputState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuInputProps>(), { disabled: false });
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuInputState;
  }): unknown;
}>();

const menu = injectMenu('Input');
const filter = injectFilter(menu, 'Input');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
// A change that a listener cancels renders the input again, and Vue writes the query back.
const revision = shallowRef(0);
let composing = false;

watch(element, (input) => (filter.input.value = input), { flush: 'sync' });
onUnmounted(() => {
  if (filter.input.value === element.value) filter.input.value = null;
});

const state = computed<MenuInputState>(() => ({ highlighted: filter.inputHighlighted }));

function commit(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!filter.setQuery(value, value === '' ? 'input-clear' : 'input-change', event)) {
    revision.value += 1;
  }
}

function elementProps() {
  void revision.value;
  const controlled = menu.listElement.value;
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      type: 'text',
      role: 'searchbox',
      value: filter.query,
      disabled: props.disabled ? '' : undefined,
      'aria-controls': controlled?.id || undefined,
      'aria-activedescendant': menu.list.highlighted?.element.id || undefined,
      inputmode: 'search',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      'data-highlighted': filter.inputHighlighted ? '' : undefined,
      onKeydown: filter.onInputKeydown,
      onFocus: filter.onInputFocus,
      onBlur: filter.onInputBlur,
      onInput(event: Event) {
        // The query is the text before a composition until it ends.
        if (!composing) commit(event);
      },
      onCompositionstart() {
        composing = true;
      },
      onCompositionend(event: CompositionEvent) {
        composing = false;
        commit(event);
      },
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
