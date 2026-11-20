<script setup lang="ts">
import { onMounted, useSlots } from 'vue';
// `postcssIsolateStyles` covers the theme folder and would change each utility, so the style sheet
// of the Tailwind demos is not there. The frame is the component that needs it.
import '../../demos/tailwind.css';
import { demoVariant, restoreDemoVariant, selectDemoVariant } from './demoVariant.ts';
import type { DemoVariant } from './demoVariant.ts';

const slots = useSlots();

// A computed does not see a change of the slots, so the template calls this function in each
// render. A page that gives only the `#tailwind` slot shows it and has no select.
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

/* A copied style sheet gives the placeholder of a trigger `oklch(55.6% 0 0)` in the light theme and
   `oklch(70.8% 0 0)` in the dark theme. Behind that text the trigger paints a hover color, a color
   for an open popup and a color for `:active`. In the light theme the contrast is 4.35:1 on the
   first two and 3.76:1 on the third. In the dark theme it is 4.01:1 on the third. These rules use
   the next gray of the sheets that has 4.5:1 or more on each of these colors. They apply in each
   state, so the text keeps its color when the pointer is on the trigger. A trigger in
   `ActionButtons` shows only an icon. The last selector is the class that gives the color in the
   Tailwind variant. */
.demo-frame
  :deep(
    :is(
      [class*='_Value_'],
      [class*='_Trigger_']:not([class*='_ActionButtons_'] *),
      [class~='data-placeholder:text-neutral-500']
    )[data-placeholder]
  ) {
  color: oklch(43.9% 0 0deg);
}

.dark
  .demo-frame
  :deep(
    :is(
      [class*='_Value_'],
      [class*='_Trigger_']:not([class*='_ActionButtons_'] *),
      [class~='data-placeholder:text-neutral-500']
    )[data-placeholder]
  ) {
  color: oklch(87% 0 0deg);
}

/* A copied style sheet gives a red button `oklch(70.4% 0.191 22.216)` in the dark theme. On the
   color of `:active`, `oklch(37.1% 0 0)`, that text has 3.59:1 contrast. The sheets have no lighter
   red, so this rule uses the next lighter red of the Tailwind palette, which is the palette of the
   sheets. It has 5.40:1. */
.dark
  .demo-frame
  :deep(
    :is([class*='_Button_'][data-color='red'], [class*='_DangerButton_']):active:not(:disabled)
  ) {
  color: oklch(80.8% 0.114 19.571deg);
}

/* The site gives a selection a gray highlight. In Chromium and WebKit, that highlight reaches the
   demos, because a highlight gets the style of the highlight of its parent. A Date Field and a
   Time Field select the text of a segment when it gets the focus, and the sheets give a focused
   segment inverted colors. The highlight then hides the text: the contrast is 1.19:1 in the light
   theme and 1.46:1 in the dark theme. This rule takes the highlight from the focused segment, so
   the inverted colors show. The second selector names the class that gives the inverted background
   in the Tailwind variant. */
.demo-frame :deep(:is([class*='_Segment_'], [class~='focus:bg-neutral-950']):focus)::selection {
  background-color: transparent;
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
