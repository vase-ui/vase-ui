<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Tabs } from '../../src/tabs';

// Each part renders its element in the `element` slot. The tabs are a link, a `<span>`, a button in
// a disabled fieldset and a button. With `teleported`, one more tab is in a `<Teleport>`.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  link: Object as PropType<Record<string, unknown>>,
  teleported: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const listPart = useTemplateRef('listPart');
const linkPart = useTemplateRef('linkPart');
const panelPart = useTemplateRef('panelPart');
const indicatorPart = useTemplateRef('indicatorPart');
defineExpose({
  root: rootPart,
  list: listPart,
  link: linkPart,
  panel: panelPart,
  indicator: indicatorPart,
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Tabs.Root ref="rootPart" v-bind="root">
    <template #element="{ props: rootProps, elementRef: rootRef, state: rootState }">
      <section v-bind="rootProps" :ref="rootRef" :data-state="rootState.orientation">
        <Tabs.List ref="listPart" aria-label="Sections">
          <template #element="{ props: listProps, elementRef: listRef }">
            <nav v-bind="listProps" :ref="listRef">
              <Tabs.Tab ref="linkPart" value="link" v-bind="link">
                <template #element="{ props: tabProps, elementRef: tabRef, state }">
                  <a v-bind="tabProps" :ref="tabRef" href="#link" :data-state="state.active">
                    Link
                  </a>
                </template>
              </Tabs.Tab>
              <Tabs.Tab value="span">
                <template #element="{ props: tabProps, elementRef: tabRef }">
                  <span v-bind="tabProps" :ref="tabRef">Span</span>
                </template>
              </Tabs.Tab>
              <fieldset disabled>
                <Tabs.Tab value="fieldset">In a fieldset</Tabs.Tab>
              </fieldset>
              <Tabs.Tab value="button">Button</Tabs.Tab>
              <Teleport v-if="teleported" to="body">
                <Tabs.Tab value="teleported">Teleported</Tabs.Tab>
              </Teleport>
              <Tabs.Indicator ref="indicatorPart">
                <template #element="{ props: indicatorProps, elementRef: indicatorRef }">
                  <i v-bind="indicatorProps" :ref="indicatorRef" />
                </template>
              </Tabs.Indicator>
            </nav>
          </template>
        </Tabs.List>
        <Tabs.Panel ref="panelPart" value="link">
          <template #element="{ props: panelProps, elementRef: panelRef, state }">
            <article v-bind="panelProps" :ref="panelRef" :data-state="state.hidden">
              Link panel
            </article>
          </template>
        </Tabs.Panel>
      </section>
    </template>
  </Tabs.Root>
  <input id="after" aria-label="After" />
</template>
