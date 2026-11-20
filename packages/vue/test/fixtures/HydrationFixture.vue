<script setup lang="ts">
import { useId } from 'vue';

const headingId = useId();
const inputId = useId();
// Vue compares a text from the script while it hydrates, and not the text of a static element. The
// text has a sibling, so Vue compares it as a text node and not as the content of the button.
const press = 'Press';

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
    <button type="button" aria-pressed="false">{{ press }}<span /></button>
    <div>Content</div>
    <component :is="SCRIPT" :innerHTML="script" />
  </section>
</template>
