<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import ToastButton from './ToastButton.vue';
import ToastList from './ToastList.vue';
</script>

<template>
  <Toast.Provider>
    <ToastButton />
    <Toast.Portal>
      <Toast.Viewport
        class="fixed top-[1rem] right-0 bottom-auto left-0 z-1 mx-auto w-[calc(100vw-2rem)] max-w-[22.5rem]"
        aria-label="Top notifications"
      >
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
