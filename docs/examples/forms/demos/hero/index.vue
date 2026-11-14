<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import toastStyles from '../../../../demos/toast/hero/css-modules/index.module.css';
import ExampleForm from './ExampleForm.vue';
import ToastList from './ToastList.vue';
</script>

<template>
  <Toast.Provider :limit="1">
    <ExampleForm />
    <Toast.Portal>
      <Toast.Viewport :class="toastStyles.Viewport">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
