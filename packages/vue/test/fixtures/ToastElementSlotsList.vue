<script setup lang="ts">
import { onMounted } from 'vue';
import { Toast } from '../../src/toast';

// The viewport and the root render elements of the developer in their `element` slots.
const manager = Toast.useToastManager();
onMounted(() => manager.add({ id: 'a', title: 'Title' }));
</script>

<template>
  <Toast.Viewport aria-label="Notifications">
    <template #element="{ props, elementRef, state }">
      <section v-bind="props" :ref="elementRef" :data-expanded-state="state.expanded">
        <Toast.Root v-for="toast in manager.toasts.value" :key="toast.id" :toast="toast">
          <template #element="{ props: rootProps, elementRef: rootRef }">
            <article v-bind="rootProps" :ref="rootRef" :data-id="toast.id">
              <Toast.Title />
            </article>
          </template>
        </Toast.Root>
      </section>
    </template>
  </Toast.Viewport>
</template>
