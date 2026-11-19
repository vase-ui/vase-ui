<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Input } from '../../src/input';

defineProps({
  scene: { type: Object as PropType<{ disabled: boolean }>, required: true },
  tag: { type: String as PropType<'fieldset' | 'div'>, required: true },
});
</script>

<template>
  <Fieldset.Root :disabled="scene.disabled">
    <template #element="{ props, elementRef, state }">
      <component
        :is="tag"
        v-bind="props"
        :ref="elementRef"
        class="Group"
        :data-state-disabled="state.disabled || undefined"
      >
        <Fieldset.Legend>Billing</Fieldset.Legend>
        <Input id="inside" aria-label="Inside" />
      </component>
    </template>
  </Fieldset.Root>
</template>
