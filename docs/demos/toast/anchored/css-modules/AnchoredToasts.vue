<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const { toasts } = Toast.useToastManager();

const startingClass = styles.Starting;
const endingClass = styles.Ending;
</script>

<template>
  <Toast.Portal>
    <Toast.Viewport :class="styles.Viewport" aria-label="Anchored notifications">
      <TransitionGroup
        :enter-from-class="startingClass"
        :leave-to-class="endingClass"
        :duration="100"
      >
        <Toast.Positioner
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          :class="styles.Positioner"
        >
          <Toast.Root :toast="toast" :class="styles.Toast">
            <Toast.Content>
              <Toast.Description :class="styles.Description" />
            </Toast.Content>
          </Toast.Root>
        </Toast.Positioner>
      </TransitionGroup>
    </Toast.Viewport>
  </Toast.Portal>
</template>
