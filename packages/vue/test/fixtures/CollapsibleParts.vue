<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Collapsible } from '../../src/collapsible';

// A root with a trigger and a panel. `transition` puts the panel in a `<Transition>` of that name,
// or of JavaScript hooks with `js`; each hook writes its phase and the classes of the element in
// `log`. `scene.panel` removes the panel with `false` and replaces it with `swap`; `scene.lines` is
// the number of lines of the panel; `scene.input` puts an input in the panel; `scene.nested` puts a
// closed root with `hiddenUntilFound` in the panel; `scene.fieldset` disables the fieldset around
// the trigger. Text inputs stand before and after the root, because WebKit on macOS gives Tab no
// button.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  trigger: Object as PropType<Record<string, unknown>>,
  panel: Object as PropType<Record<string, unknown>>,
  transition: String,
  scene: {
    type: Object as PropType<{
      panel?: boolean | 'swap';
      lines?: number;
      input?: boolean;
      nested?: boolean;
      fieldset?: boolean;
    }>,
    default: () => ({}),
  },
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});
const rootPart = useTemplateRef('rootPart');
const triggerPart = useTemplateRef('triggerPart');
const panelPart = useTemplateRef('panelPart');
defineExpose({ root: rootPart, trigger: triggerPart, panel: panelPart });

function record(phase: string, element: Element) {
  props.log.add(`${phase} ${element.className}`.trim());
}

function leaveLater(element: Element, done: () => void) {
  record('leave', element);
  setTimeout(() => {
    record('done', element);
    done();
  }, 300);
}
</script>

<template>
  <input aria-label="Before" />
  <Collapsible.Root ref="rootPart" v-bind="root">
    <fieldset :disabled="scene.fieldset">
      <Collapsible.Trigger ref="triggerPart" v-slot="{ state }" v-bind="trigger">
        Trigger <span class="TriggerState">{{ state.disabled ? 'disabled' : '' }}</span>
      </Collapsible.Trigger>
    </fieldset>
    <Transition
      v-if="transition === 'js'"
      :css="false"
      @enter="(element: Element) => record('enter', element)"
      @leave="leaveLater"
    >
      <Collapsible.Panel ref="panelPart" class="Panel" v-bind="panel">
        <p v-for="line in scene.lines ?? 1" :key="line" class="Line">Line {{ line }}</p>
      </Collapsible.Panel>
    </Transition>
    <Transition
      v-else-if="transition"
      :name="transition"
      @enter="(element: Element) => record('enter', element)"
      @after-enter="(element: Element) => record('after-enter', element)"
      @leave="(element: Element) => record('leave', element)"
      @after-leave="(element: Element) => record('after-leave', element)"
    >
      <Collapsible.Panel ref="panelPart" class="Panel" v-bind="panel">
        <p v-for="line in scene.lines ?? 1" :key="line" class="Line">Line {{ line }}</p>
      </Collapsible.Panel>
    </Transition>
    <Collapsible.Panel v-else-if="scene.panel === 'swap'" class="Panel" id="swapped">
      Swapped
    </Collapsible.Panel>
    <Collapsible.Panel v-else-if="scene.panel !== false" ref="panelPart" class="Panel" v-bind="panel">
      <p v-for="line in scene.lines ?? 1" :key="line" class="Line">Line {{ line }}</p>
      <input v-if="scene.input" aria-label="Inside" />
      <p id="collapsible-target">Needle</p>
      <Collapsible.Root v-if="scene.nested" class="Nested">
        <Collapsible.Panel hidden-until-found>
          <p id="collapsible-inner-target">Inner needle</p>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Collapsible.Panel>
  </Collapsible.Root>
  <input aria-label="After" />
</template>

<style>
.Line {
  margin: 0;
  height: 20px;
}
.collapsible-fade-enter-active,
.collapsible-fade-leave-active {
  transition: opacity 300ms linear;
}
.collapsible-fade-enter-from,
.collapsible-fade-leave-to {
  opacity: 0;
}
.collapsible-size-enter-active,
.collapsible-size-leave-active {
  overflow: hidden;
  transition: height 300ms linear;
}
.collapsible-size-enter-from,
.collapsible-size-leave-to {
  height: 0;
}
.collapsible-size-enter-to,
.collapsible-size-leave-from {
  height: var(--collapsible-panel-height);
}
/* A kept panel that animates its height, and whose closed box stays. */
.KeptSize {
  overflow: hidden;
  height: var(--collapsible-panel-height);
  transition: height 100ms linear;
}
.KeptSize[hidden] {
  display: block;
  height: 0;
}
</style>
