<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import PulseToastButton from './PulseToastButton.vue';
import styles from './index.module.css';
import ToastList from './ToastList.vue';
</script>

<template>
  <Toast.Provider>
    <PulseToastButton />
    <Toast.Portal>
      <Toast.Viewport :class="styles.Viewport">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
