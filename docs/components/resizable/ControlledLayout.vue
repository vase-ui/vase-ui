<script setup lang="ts">
import { ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';

const layout = ref<ResizableLayout>({});
</script>

<template>
  <button type="button" @click="layout = {}">Give the first sizes</button>
  <Resizable.Root v-slot="{ sizes }" v-model="layout">
    <Resizable.Panel id="navigation" :default-size="25" />
    <Resizable.Handle
      aria-label="Resize the navigation"
      :aria-valuetext="`${Math.round(sizes.navigation ?? 25)} percent`"
    />
    <Resizable.Panel id="editor" />
  </Resizable.Root>
</template>
