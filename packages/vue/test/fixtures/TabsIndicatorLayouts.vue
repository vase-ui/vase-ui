<script setup lang="ts">
import { defineAsyncComponent, type PropType } from 'vue';
import { CSPProvider } from '../../src/csp-provider';
import { Tabs } from '../../src/tabs';

type LayoutTab = { value: unknown; style?: string; anchor?: boolean };

// Tabs with the styles of a case, and `scene.indicators` indicators with the attributes `indicator`. With
// `scroller`, the tabs are in a container that scrolls inside the list. A tab with `anchor` renders
// a link in the `element` slot. With `slotted`, the indicator renders a `<b>` in the `element` slot.
// With `late`, the indicator is an async component in `<Suspense>`, so it hydrates after its list.
// `renders` gets the size of the state at each render of the slotted indicator.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  wrapperStyle: String,
  listStyle: { type: String, default: 'display: flex; position: relative' },
  tabs: { type: Array as PropType<LayoutTab[]>, required: true },
  indicator: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ indicators: number }>, default: () => ({ indicators: 1 }) },
  scroller: Boolean,
  slotted: Boolean,
  late: Boolean,
  nonce: String,
  renders: Array as PropType<string[]>,
});

const AsyncIndicator = defineAsyncComponent(() => Promise.resolve(Tabs.Indicator));
</script>

<template>
  <CSPProvider :nonce="nonce">
    <div :style="wrapperStyle">
      <Tabs.Root v-bind="root">
        <Tabs.List data-testid="list" :style="listStyle">
          <div
            v-if="scroller"
            data-testid="scroller"
            style="display: flex; width: 200px; overflow-x: auto"
          >
            <Tabs.Tab
              v-for="tab in tabs"
              :key="String(tab.value)"
              :value="tab.value"
              :style="tab.style"
            >
              {{ tab.value }}
            </Tabs.Tab>
          </div>
          <template v-else>
            <template v-for="tab in tabs" :key="String(tab.value)">
              <Tabs.Tab v-if="tab.anchor" :value="tab.value" :style="tab.style">
                <template #element="{ props, elementRef }">
                  <a v-bind="props" :ref="elementRef" href="#tab">{{ tab.value }}</a>
                </template>
              </Tabs.Tab>
              <Tabs.Tab v-else :value="tab.value" :style="tab.style">{{ tab.value }}</Tabs.Tab>
            </template>
          </template>
          <Suspense v-if="late">
            <AsyncIndicator class="Indicator" data-testid="indicator-1" v-bind="indicator" />
          </Suspense>
          <template v-else-if="slotted">
            <Tabs.Indicator v-bind="indicator">
              <template #element="{ props, elementRef, state }">
                <b
                  v-bind="props"
                  :ref="elementRef"
                  class="Indicator"
                  data-testid="indicator-1"
                  :data-render="
                    renders?.push(`${state.activeTabSize?.width} ${state.activeTabPosition?.left}`)
                  "
                />
              </template>
            </Tabs.Indicator>
          </template>
          <template v-else>
            <Tabs.Indicator
              v-for="index in scene.indicators"
              :key="index"
              class="Indicator"
              :data-testid="`indicator-${index}`"
              v-bind="indicator"
            />
          </template>
        </Tabs.List>
      </Tabs.Root>
    </div>
  </CSPProvider>
</template>

<style scoped>
.Indicator {
  outline-style: dashed;
}
</style>
