<script setup lang="ts">
import { shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import type { CheckboxRootChangeEventDetails } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import type { CheckboxGroupChangeEventDetails } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

const props = withDefaults(
  defineProps<{
    // `model` binds `v-model:checked`. `keeps` gives `checked` and keeps it for each change.
    mode?: 'uncontrolled' | 'model' | 'keeps' | 'field' | 'group';
    defaultChecked?: boolean;
    checked?: boolean | undefined;
    indeterminate?: boolean;
    readOnly?: boolean;
    disabled?: boolean;
  }>(),
  { mode: 'uncontrolled', checked: undefined },
);

const model = shallowRef(props.checked);
const groupModel = shallowRef<string[]>([]);
const changes = shallowRef<string[]>([]);

function handleCheckedChange(checked: boolean, details: CheckboxRootChangeEventDetails) {
  changes.value = [...changes.value, `${checked} (${details.event.type})`];
}

function handleGroupChange(value: string[], details: CheckboxGroupChangeEventDetails) {
  changes.value = [...changes.value, `${value.join(',')} (${details.event.type})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <CheckboxGroup
      v-if="mode === 'group'"
      v-model:value="groupModel"
      :all-values="['a', 'b']"
      @value-change="handleGroupChange"
    >
      <label data-testid="label-parent"><Checkbox.Root parent data-testid="parent" />All</label>
      <label data-testid="label-a"><Checkbox.Root value="a" data-testid="checkbox-a" />A</label>
      <label data-testid="label-b"><Checkbox.Root value="b" data-testid="checkbox-b" />B</label>
    </CheckboxGroup>
    <Field.Root v-else-if="mode === 'field'" data-testid="field">
      <label data-testid="label">
        <Checkbox.Root
          :default-checked="defaultChecked"
          data-testid="checkbox"
          @checked-change="handleCheckedChange"
        />
        News
      </label>
    </Field.Root>
    <label v-else-if="mode === 'model'" data-testid="label">
      <Checkbox.Root
        v-model:checked="model"
        data-testid="checkbox"
        @checked-change="handleCheckedChange"
      />
      News
    </label>
    <label v-else-if="mode === 'keeps'" data-testid="label">
      <Checkbox.Root :checked="model" data-testid="checkbox" @checked-change="handleCheckedChange" />
      News
    </label>
    <label v-else data-testid="label">
      <Checkbox.Root
        :default-checked="defaultChecked"
        :indeterminate="indeterminate"
        :read-only="readOnly"
        :disabled="disabled"
        data-testid="checkbox"
        @checked-change="handleCheckedChange"
      />
      News
    </label>
  </form>
  <output data-testid="model">{{ mode === 'group' ? groupModel.join(',') : model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
