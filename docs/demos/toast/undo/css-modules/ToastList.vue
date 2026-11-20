<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const { toasts } = Toast.useToastManager();

const startingClass = styles.Starting;
const endingClass = styles.Ending;
</script>

<template>
  <TransitionGroup :enter-from-class="startingClass" :leave-to-class="endingClass">
    <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" :class="styles.Toast">
      <Toast.Content :class="styles.Content">
        <div :class="styles.Text">
          <div :class="styles.Message">
            <Toast.Title :class="styles.Title" />
            <Toast.Description :class="styles.Description" />
          </div>
          <Toast.Action :class="styles.UndoButton" />
        </div>
      </Toast.Content>
    </Toast.Root>
  </TransitionGroup>
</template>
