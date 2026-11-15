<script setup lang="ts">
import { onMounted, useSlots } from 'vue';
// `postcssIsolateStyles` covers the theme folder and would change each utility, so the style sheet
// of the Tailwind demos is not there. The frame is the component that needs it.
import '../../demos/tailwind.css';
import { demoVariant, restoreDemoVariant, selectDemoVariant } from './demoVariant.ts';
import type { DemoVariant } from './demoVariant.ts';

const slots = useSlots();

// The template calls this function, so a change of the slots changes the result. A page that gives
// only the `#tailwind` slot shows it and has no select.
function shownVariant(): DemoVariant {
  return slots.tailwind !== undefined &&
    (slots.default === undefined || demoVariant.value === 'tailwind')
    ? 'tailwind'
    : 'css-modules';
}

// The select has `autocomplete="off"`. Firefox restores the value of a select when the page loads
// again. That value can differ from the stored choice, and the select then shows another variant
// than the demos until Vue hydrates the page.
function select(event: Event) {
  const control = event.currentTarget;
  if (control instanceof HTMLSelectElement) {
    void selectDemoVariant(control.value === 'tailwind' ? 'tailwind' : 'css-modules', control);
  }
}

onMounted(restoreDemoVariant);
</script>

<template>
  <div class="demo">
    <div class="demo-frame vp-raw" :data-demo="shownVariant()">
      <slot v-if="shownVariant() === 'tailwind'" name="tailwind" />
      <slot v-else />
    </div>
    <div v-if="$slots.tailwind && $slots.default" class="demo-toolbar">
      <select aria-label="Styling method" autocomplete="off" :value="demoVariant" @change="select">
        <option value="css-modules">CSS Modules</option>
        <option value="tailwind">Tailwind v4</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.demo {
  margin: 1.25rem 0 1.5rem;
}

.demo:has(+ .vp-code-group, + .demo-source) {
  margin-bottom: 0;
}

/* A copied style sheet of Base UI sets no color on the page behind its demo. The frame sets the
   page colors that the style sheets assume, for the theme of the site.
   The look is the demo playground of the Base UI docs: docs/src/components/Demo/Demo.css.
   The playground of Base UI is 8rem high inside the border of its card, so the height here
   includes the two borders of the frame. */
.demo-frame {
  display: flex;
  align-items: center;
  justify-content: safe center;
  overflow-x: auto;
  box-sizing: border-box;
  min-height: calc(8rem + 2px);
  padding: 2rem 1.5rem;
  border: 1px solid var(--vase-color-border);
  border-radius: var(--vase-radius-12);
  background-color: white;
  color: oklch(14.5% 0 0deg);
}

.dark .demo-frame {
  background-color: black;
  color: white;
}

.demo:has(> .demo-toolbar) .demo-frame,
.demo:has(+ .vp-code-group, + .demo-source) .demo-frame {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}

/* The sizes are those of `.DemoToolbar`, `.DemoToolbarActions` and `.GhostButton` of the Base UI
   docs. */
.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  box-sizing: border-box;
  height: calc(2.25rem + 1px);
  padding-inline: 0.5rem;
  border: 1px solid var(--vase-color-border);
  border-top: 0;
  border-end-start-radius: var(--vase-radius-12);
  border-end-end-radius: var(--vase-radius-12);
  background-color: var(--vp-code-block-bg);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--vase-gray-t2);
}

.demo:has(+ .vp-code-group, + .demo-source) .demo-toolbar {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}

.demo-toolbar select {
  height: 1.75rem;
  padding-inline: 0.5rem;
  border-radius: 0.5rem;
}

.demo-toolbar select:focus-visible {
  outline: 2px solid var(--vase-gray-t2);
  outline-offset: -1px;
}

@media (hover: hover) {
  .demo-toolbar select:hover:not(:focus-visible) {
    background-color: var(--vase-gray-c1);
  }
}
</style>
