<script setup lang="ts">
import { ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';

const APPLES = ['fuji', 'gala', 'granny-smith'];

const apples = ref(['fuji']);
</script>

<template>
  <main>
    <form data-testid="form">
      <Field.Root name="apples">
        <CheckboxGroup v-model="apples" :all-values="APPLES" data-testid="group">
          <Checkbox parent aria-label="All" data-testid="parent" />
          <Checkbox
            v-for="apple in APPLES"
            :key="apple"
            :value="apple"
            :aria-label="apple"
            :data-testid="apple"
          />
        </CheckboxGroup>
        <Field.Label data-testid="label">Apples</Field.Label>
      </Field.Root>
      <output data-testid="value">{{ apples.join(',') }}</output>
    </form>
  </main>
</template>
