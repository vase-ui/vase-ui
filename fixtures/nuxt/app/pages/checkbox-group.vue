<script setup lang="ts">
import { ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

// A checkbox has no content, so an inline style gives it a size that a click can reach.
const CHECKBOX_STYLE = 'display: inline-block; width: 24px; height: 24px; border: 1px solid';

const APPLES = ['fuji', 'gala', 'granny-smith'];

const apples = ref(['fuji']);
</script>

<template>
  <main>
    <form data-testid="form">
      <Field.Root name="apples">
        <CheckboxGroup v-model:value="apples" :all-values="APPLES" data-testid="group">
          <Checkbox.Root parent aria-label="All" :style="CHECKBOX_STYLE" data-testid="parent" />
          <Checkbox.Root
            v-for="apple in APPLES"
            :key="apple"
            :value="apple"
            :aria-label="apple"
            :style="CHECKBOX_STYLE"
            :data-testid="apple"
          />
        </CheckboxGroup>
        <Field.Label data-testid="label">Apples</Field.Label>
      </Field.Root>
      <output data-testid="value">{{ apples.join(',') }}</output>
    </form>
  </main>
</template>
