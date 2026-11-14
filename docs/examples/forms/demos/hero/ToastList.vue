<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import toastStyles from '../../../../demos/toast/hero/css-modules/index.module.css';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" :class="toastStyles.Toast">
    <Toast.Content :class="toastStyles.Content">
      <div :class="toastStyles.Text">
        <Toast.Title :class="toastStyles.Title" />
        <Toast.Description :class="toastStyles.Description" />
        <pre :class="$style.Values" data-vase-ui-swipe-ignore>{{
          JSON.stringify(toast.data, null, 2)
        }}</pre>
      </div>
      <Toast.Close :class="toastStyles.Close">Dismiss</Toast.Close>
    </Toast.Content>
  </Toast.Root>
</template>

<style module>
.Values {
  margin: 0.5rem 0 0;
  padding: 0.5rem;
  border: 1px solid;
  font-size: 0.75rem;
  white-space: pre-wrap;
  -webkit-user-select: text;
  user-select: text;
}
</style>
