<script setup lang="ts">
import { Separator } from '@vase-ui/vue/separator';
import { Tabs } from '@vase-ui/vue/tabs';
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import { NuxtLink } from '#components';

const nuxtTab = useTemplateRef('nuxtTab');
const routerTab = useTemplateRef('routerTab');
const tabElements = shallowRef('');
// What a function ref on `<component :is>` gets for `NuxtLink`, with no code of the library.
const linkRef = shallowRef('');

function readLinkRef(value: unknown) {
  if (value === null) return;
  const instance = value as { $el?: Element; element?: Element };
  linkRef.value = `$el: ${instance.$el?.localName}, element: ${'element' in instance}`;
}

onMounted(() => {
  tabElements.value = [nuxtTab.value?.element, routerTab.value?.element]
    .map((element) => element?.localName)
    .join(' ');
});
</script>

<template>
  <main>
    <Separator as="span" data-testid="separator" />
    <Tabs.Root default-value="a">
      <Tabs.List>
        <Tabs.Tab ref="nuxtTab" value="a" :as="NuxtLink" to="/as" data-testid="nuxt-tab"
          >A</Tabs.Tab
        >
        <Tabs.Tab ref="routerTab" value="b" :as="RouterLink" to="/as" data-testid="router-tab"
          >B</Tabs.Tab
        >
        <Tabs.Tab value="c" as="div" data-testid="div-tab">C</Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
    <component :is="NuxtLink" :ref="readLinkRef" to="/as">Link</component>
    <output data-testid="tab-elements">{{ tabElements }}</output>
    <output data-testid="link-ref">{{ linkRef }}</output>
  </main>
</template>
