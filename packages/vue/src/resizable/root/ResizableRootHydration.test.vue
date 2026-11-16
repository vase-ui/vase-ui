<script setup lang="ts">
import { defineComponent, h, onMounted, shallowRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';

defineProps<{
  composition:
    | 'collapsed'
    | 'defaults'
    | 'edges'
    | 'fixed'
    | 'handleFirst'
    | 'hitAreaNumber'
    | 'hitAreaObject'
    | 'layout'
    | 'layoutLength'
    | 'length'
    | 'lengthMixed'
    | 'nested'
    | 'removedLast'
    | 'stateFunctions'
    | 'stored'
    | 'style'
    | 'vertical';
  laterRemovedAtMount?: boolean | undefined;
}>();

const { layout: storedLayout } = Resizable.useLayoutStorage({
  key: 'layout',
  storage: { getItem: () => '{"a":30,"b":40,"c":30}', setItem() {} },
});

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});

// The root finds this panel through its context, and not through its place in the template.
const WrappedPanel = defineComponent({
  setup(_props, { slots }) {
    return () =>
      h(Resizable.Panel, { id: 'wrapped', defaultSize: 30, 'data-testid': 'wrapped' }, slots);
  },
});
</script>

<template>
  <Resizable.Root v-if="composition === 'defaults'" data-testid="root">
    <Resizable.Panel id="a" data-testid="a" :default-size="30" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
    <Resizable.Handle data-testid="handle-b" aria-label="Second" />
    <Resizable.Panel id="c" data-testid="c" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'layout'"
    data-testid="root"
    :default-layout="{ a: 20, b: 80 }"
  >
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" aria-valuetext="Quarter" />
    <Resizable.Panel v-if="!(laterRemovedAtMount && isMounted)" id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'edges'" data-testid="root" drag-edges>
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'handleFirst'" data-testid="root">
    <Resizable.Handle data-testid="handle-first" aria-label="First" />
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="Second" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'hitAreaNumber'"
    data-testid="root"
    :hit-area-size="16"
  >
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'hitAreaObject'"
    data-testid="root"
    :hit-area-size="{ fine: 12, coarse: 30 }"
  >
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'length'" data-testid="root">
    <Resizable.Panel id="a" data-testid="a" default-size="240px" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'layoutLength'"
    data-testid="root"
    :default-layout="{ a: '15rem' }"
  >
    <Resizable.Panel id="a" data-testid="a" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'lengthMixed'" data-testid="root">
    <Resizable.Panel id="a" data-testid="a" default-size="240px" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" :default-size="30" />
    <Resizable.Handle data-testid="handle-b" aria-label="Second" />
    <Resizable.Panel id="c" data-testid="c" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'fixed'" data-testid="root">
    <Resizable.Panel id="a" data-testid="a" :default-size="20" root-resize-behavior="fixed" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'nested'" data-testid="root">
    <WrappedPanel />
    <Resizable.Handle data-testid="handle-outer" aria-label="Outer" />
    <Resizable.Panel id="outer-b" data-testid="outer-b">
      <Resizable.Root orientation="vertical" data-testid="inner-root">
        <Resizable.Panel id="inner-a" data-testid="inner-a" :default-size="25" />
        <Resizable.Handle data-testid="handle-inner" aria-label="Inner" />
        <Resizable.Panel id="inner-b" data-testid="inner-b" />
      </Resizable.Root>
    </Resizable.Panel>
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'collapsed'" data-testid="root">
    <Resizable.Panel id="a" data-testid="a" collapsible :min-size="20" :default-size="0" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel v-if="!(laterRemovedAtMount && isMounted)" id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'removedLast'"
    data-testid="root"
    :default-layout="{ a: 20, b: 50, c: 30 }"
  >
    <Resizable.Panel id="a" data-testid="a" :min-size="20" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
    <Resizable.Handle data-testid="handle-b" aria-label="Second" />
    <Resizable.Panel v-if="!(laterRemovedAtMount && isMounted)" id="c" data-testid="c" />
  </Resizable.Root>
  <Resizable.Root
    v-else-if="composition === 'stored'"
    v-model:layout="storedLayout"
    data-testid="root"
  >
    <Resizable.Panel id="a" data-testid="a" collapsible :min-size="20" :default-size="0" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
    <Resizable.Handle aria-label="Second">
      <template #render="{ props: handleProps, children }">
        <div v-bind="handleProps" data-testid="handle-b"><component :is="children" /></div>
      </template>
    </Resizable.Handle>
    <Resizable.Panel id="c" data-testid="c" collapsible :min-size="20" :default-size="0" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'stateFunctions'" data-testid="root">
    <Resizable.Panel
      id="a"
      data-testid="a"
      collapsible
      :min-size="20"
      :default-size="0"
      :state-class="(state) => (state.collapsed ? 'collapsed' : 'expanded')"
    >
      <template #default="{ state }">{{ state.collapsed ? 'Closed' : 'Open' }}</template>
    </Resizable.Panel>
    <Resizable.Handle
      data-testid="handle-a"
      aria-label="First"
      :state-class="(state) => (state.atMin ? 'at-min' : 'free')"
      :state-style="(state) => ({ opacity: state.atMin ? 0.5 : 1 })"
    />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else-if="composition === 'vertical'" data-testid="root" orientation="vertical">
    <Resizable.Panel id="a" data-testid="a" :default-size="40" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" />
  </Resizable.Root>
  <Resizable.Root v-else data-testid="root">
    <Resizable.Panel id="a" data-testid="a" :default-size="30" style="color: red" />
    <Resizable.Handle data-testid="handle-a" aria-label="First" />
    <Resizable.Panel id="b" data-testid="b" style="padding: 4px" />
  </Resizable.Root>
</template>
