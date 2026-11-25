<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Switch } from '../../src/switch';
import StyledInput from './StyledInput.vue';

defineProps({
  attrs: Object as PropType<Record<string, unknown>>,
  scene: {
    type: Object as PropType<{
      shown: boolean;
      fieldsetDisabled?: boolean;
      kind?: 'fieldset' | 'root' | 'div';
      ownDisabled?: boolean;
      focusable?: boolean;
    }>,
    default: () => ({ shown: true }),
  },
});
const marked = useTemplateRef('marked');
const styled = useTemplateRef('styled');
defineExpose({ marked, styled });
</script>

<template>
  <label>
    <Switch ref="marked" v-bind="attrs">
      <template #element="{ props, elementRef, state }">
        <span
          class="Track"
          :data-on="state.checked || undefined"
          :data-required="String(state.required)"
        >
          <input v-bind="props" :ref="elementRef" />
        </span>
      </template>
    </Switch>
    Marked
  </label>
  <label>
    <Switch ref="styled">
      <template #element="{ props, elementRef }">
        <StyledInput v-bind="props" :ref="elementRef" />
      </template>
    </Switch>
    Styled
  </label>
  <Transition>
    <Switch v-if="scene.shown" aria-label="Shown" />
  </Transition>
  <component
    :is="!scene.kind || scene.kind === 'fieldset' ? 'fieldset' : Fieldset.Root"
    :as="scene.kind === 'div' ? 'div' : undefined"
    :disabled="scene.fieldsetDisabled"
  >
    <Switch
      aria-label="Fenced"
      :disabled="scene.ownDisabled"
      :focusable-when-disabled="scene.focusable"
    >
      <template #element="{ props, elementRef, state }">
        <span class="Fence" :data-disabled="state.disabled || undefined">
          <input v-bind="props" :ref="elementRef" />
        </span>
      </template>
    </Switch>
  </component>
</template>
