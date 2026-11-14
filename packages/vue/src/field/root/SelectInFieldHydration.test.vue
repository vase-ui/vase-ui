<script setup lang="ts">
import { shallowRef } from 'vue';
import { Checkbox } from '../../checkbox';
import { Field } from '../index';
import * as Select from '../../select/index.parts';

const props = defineProps<{ control?: 'checkbox' | 'select' | undefined }>();

const control = shallowRef(props.control ?? 'checkbox');
const hasLabel = shallowRef(true);

function toggleControl() {
  control.value = control.value === 'select' ? 'checkbox' : 'select';
}
</script>

<template>
  <Field.Root>
    <Field.Label v-if="hasLabel" :native-label="false" as="div" data-testid="label">
      Label
    </Field.Label>
    <Select.Root v-if="control === 'select'">
      <Select.Trigger data-testid="trigger">
        <Select.Value placeholder="Pick one" />
      </Select.Trigger>
    </Select.Root>
    <Checkbox.Root v-else data-testid="checkbox" />
  </Field.Root>
  <button type="button" @click="toggleControl">Toggle</button>
  <button type="button" @click="hasLabel = false">Remove Label</button>
</template>
