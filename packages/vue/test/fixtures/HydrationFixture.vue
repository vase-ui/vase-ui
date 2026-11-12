<script setup lang="ts">
import { useVaseUiId } from '../../src/internals/useBaseUiId';
import ChildrenPart from './ChildrenPart.vue';
import PlainPart from './PlainPart.vue';

const headingId = useVaseUiId();
const inputId = useVaseUiId();

// Vue refuses a `<script>` tag in a template, so the template renders it as a dynamic tag.
const SCRIPT = 'script';
const script =
  'globalThis.vaseUiHydrationScriptRuns = (globalThis.vaseUiHydrationScriptRuns ?? 0) + 1;';
</script>

<template>
  <h2 :id="headingId">Fixture</h2>
  <section :aria-labelledby="headingId">
    <label :for="inputId">Name</label>
    <input :id="inputId" type="text" />
    <PlainPart as="button" aria-pressed="false">Press</PlainPart>
    <ChildrenPart :value="1">Content</ChildrenPart>
    <component :is="SCRIPT" :innerHTML="script" />
  </section>
</template>
