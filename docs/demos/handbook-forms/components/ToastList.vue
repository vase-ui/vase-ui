<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import layout from '../../../examples/forms/layout.module.css';
import toastStyles from '../../toast/hero/css-modules/index.module.css';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" :class="toastStyles.Toast">
    <Toast.Content :class="toastStyles.Content">
      <div :class="toastStyles.Text">
        <Toast.Title :class="toastStyles.Title" />
        <Toast.Description :class="toastStyles.Description" />
        <pre :class="layout.Values" data-vase-ui-swipe-ignore>{{
          JSON.stringify(toast.data, null, 2)
        }}</pre>
      </div>
      <Toast.Close :class="toastStyles.Close">Dismiss</Toast.Close>
    </Toast.Content>
  </Toast.Root>
</template>
