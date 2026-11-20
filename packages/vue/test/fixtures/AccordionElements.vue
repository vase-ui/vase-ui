<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Accordion } from '../../src/accordion';

// Each part renders its element in the `element` slot, and writes its state in `data-state`. The
// trigger is a `<span>`.
const rootPart = useTemplateRef('rootPart');
const itemPart = useTemplateRef('itemPart');
const headerPart = useTemplateRef('headerPart');
const triggerPart = useTemplateRef('triggerPart');
const panelPart = useTemplateRef('panelPart');
defineExpose({
  root: rootPart,
  item: itemPart,
  header: headerPart,
  trigger: triggerPart,
  panel: panelPart,
});
</script>

<template>
  <Accordion.Root ref="rootPart" :default-value="['a']">
    <template #element="{ props: rootProps, elementRef: rootRef, state: rootState }">
      <section v-bind="rootProps" :ref="rootRef" :data-state="JSON.stringify(rootState)">
        <Accordion.Item ref="itemPart" value="a">
          <template #element="{ props: itemProps, elementRef: itemRef, state: itemState }">
            <article v-bind="itemProps" :ref="itemRef" :data-state="JSON.stringify(itemState)">
              <Accordion.Header ref="headerPart">
                <template #element="{ props: headerProps, elementRef: headerRef, state }">
                  <h4 v-bind="headerProps" :ref="headerRef" :data-state="JSON.stringify(state)">
                    <Accordion.Trigger ref="triggerPart">
                      <template #element="{ props: triggerProps, elementRef: triggerRef, state }">
                        <span
                          v-bind="triggerProps"
                          :ref="triggerRef"
                          :data-state="JSON.stringify(state)"
                        >
                          Trigger
                        </span>
                      </template>
                    </Accordion.Trigger>
                  </h4>
                </template>
              </Accordion.Header>
              <Accordion.Panel ref="panelPart">
                <template #element="{ props: panelProps, elementRef: panelRef, state }">
                  <aside v-bind="panelProps" :ref="panelRef" :data-state="JSON.stringify(state)">
                    Content
                  </aside>
                </template>
              </Accordion.Panel>
            </article>
          </template>
        </Accordion.Item>
      </section>
    </template>
  </Accordion.Root>
</template>
