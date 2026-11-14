<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

defineProps<{ toast: Toast.Root.ToastObject }>();
</script>

<template>
  <Toast.Provider>
    <Toast.Portal>
      <Toast.Viewport>
        <!-- Stacked toasts -->
        <Toast.Root :toast="toast">
          <Toast.Content>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action />
            <Toast.Close />
          </Toast.Content>
        </Toast.Root>

        <!-- Anchored toasts -->
        <Toast.Positioner :toast="toast">
          <Toast.Root :toast="toast">
            <Toast.Arrow />
            <Toast.Content>
              <Toast.Title />
              <Toast.Description />
              <Toast.Action />
              <Toast.Close />
            </Toast.Content>
          </Toast.Root>
        </Toast.Positioner>
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
