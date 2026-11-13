<script lang="ts">
import { defineAsyncComponent } from 'vue';
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';

// The module makes the component one time, as a lazy component of Nuxt is made. After its first
// render, a server has the component loaded and runs its `setup` in the order of the document.
// A browser has not loaded it when the page hydrates, so it runs that `setup` after the later parts.
const LazyFieldControlPart = defineAsyncComponent(() => Promise.resolve(FieldControlPart));
</script>

<script setup lang="ts">
import FieldErrorPart from '../../../test/fixtures/FieldErrorPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FieldStatePart from '../../../test/fixtures/FieldStatePart.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';
import type { Errors } from '../form-context/FormContext';

defineProps<{
  rootName?: string | undefined;
  controlName?: string | undefined;
  errors?: Errors | undefined;
}>();
</script>

<template>
  <FormScope :errors="errors" data-testid="form">
    <FieldScope :name="rootName" data-testid="root">
      <FieldStatePart data-testid="before" />
      <Suspense>
        <LazyFieldControlPart id="control" :name="controlName" value="x" data-testid="control" />
      </Suspense>
      <FieldStatePart data-testid="after" />
      <FieldErrorPart data-testid="error" />
    </FieldScope>
  </FormScope>
</template>
