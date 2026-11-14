<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

withDefaults(
  defineProps<{
    variant?: 'shared' | 'items';
    nativeButton?: boolean;
    defaultValue?: string[];
  }>(),
  { variant: 'shared', nativeButton: false, defaultValue: () => [] },
);
</script>

<template>
  <Field.Root v-if="variant === 'shared'" name="apples">
    <Field.Label data-testid="label">Apples</Field.Label>
    <CheckboxGroup data-testid="group" :all-values="['fuji', 'gala']" :default-value="defaultValue">
      <Checkbox.Root
        parent
        data-testid="parent"
        :native-button="nativeButton"
        :as="nativeButton ? 'button' : undefined"
      />
      <Checkbox.Root
        value="fuji"
        data-testid="fuji"
        :native-button="nativeButton"
        :as="nativeButton ? 'button' : undefined"
      />
      <Checkbox.Root
        value="gala"
        data-testid="gala"
        :native-button="nativeButton"
        :as="nativeButton ? 'button' : undefined"
      />
    </CheckboxGroup>
  </Field.Root>
  <Field.Root v-else name="apple">
    <CheckboxGroup data-testid="group" :all-values="['fuji']" :default-value="defaultValue">
      <Field.Item>
        <Field.Label data-testid="label">All</Field.Label>
        <Checkbox.Root
          parent
          data-testid="parent"
          :native-button="nativeButton"
          :as="nativeButton ? 'button' : undefined"
        />
      </Field.Item>
      <Field.Item>
        <Field.Label data-testid="label">Fuji</Field.Label>
        <Checkbox.Root
          value="fuji"
          data-testid="fuji"
          :native-button="nativeButton"
          :as="nativeButton ? 'button' : undefined"
        />
      </Field.Item>
    </CheckboxGroup>
  </Field.Root>
</template>
