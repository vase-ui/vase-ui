<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Portal>
    <Toast.Viewport aria-label="Notifications">
      <TransitionGroup name="toast">
        <!-- Stacked toasts -->
        <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast">
          <Toast.Content>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action />
            <Toast.Close />
          </Toast.Content>
        </Toast.Root>
      </TransitionGroup>
    </Toast.Viewport>
  </Toast.Portal>

  <!-- Anchored toasts, in a provider of their own -->
  <Toast.Portal>
    <Toast.Viewport aria-label="Anchored notifications">
      <TransitionGroup name="toast" :duration="100">
        <Toast.Positioner v-for="toast in toasts" :key="toast.id" :toast="toast">
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
      </TransitionGroup>
    </Toast.Viewport>
  </Toast.Portal>
</template>
