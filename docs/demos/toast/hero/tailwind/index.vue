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
        aria-label="Notifications"
        class="fixed top-auto right-[1rem] bottom-[1rem] z-1 mx-auto w-[calc(100vw-2rem)] sm:right-[2rem] sm:bottom-[2rem] sm:w-[22.5rem]"
      >
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
