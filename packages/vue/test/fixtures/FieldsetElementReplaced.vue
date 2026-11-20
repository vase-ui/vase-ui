<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
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
        :role="tag === 'div' ? 'group' : undefined"
        class="Group"
        :data-state-disabled="state.disabled || undefined"
      >
        <Fieldset.Legend>Billing</Fieldset.Legend>
        <Input id="inside" aria-label="Inside" />
        <Field.Root>
          <Field.Label>In a field</Field.Label>
          <Input id="in-field" />
        </Field.Root>
      </component>
    </template>
  </Fieldset.Root>
</template>
