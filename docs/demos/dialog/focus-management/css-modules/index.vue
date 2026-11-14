<script setup lang="ts">
import { useId, useTemplateRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import styles from './index.module.css';

const initialFocusRef = useTemplateRef<HTMLInputElement>('initialFocus');
const finalFocusRef = useTemplateRef<HTMLButtonElement>('finalFocus');
const nameId = useId();
const feedbackId = useId();
</script>

<template>
  <div :class="styles.Container">
    <Dialog.Root>
      <Dialog.Trigger :class="styles.Button">Open feedback</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop :class="styles.Backdrop" />
        <Dialog.Popup
          :class="styles.Popup"
          :initial-focus="initialFocusRef"
          :final-focus="finalFocusRef"
        >
          <div :class="styles.Intro">
            <Dialog.Title :class="styles.Title">Feedback form</Dialog.Title>
            <Dialog.Description :class="styles.Description">
              Your feedback means a lot to us.
            </Dialog.Description>
          </div>
          <div :class="styles.Fields">
            <div :class="styles.Field">
              <label :for="nameId" :class="styles.Label">Full name</label>
              <input :id="nameId" placeholder="Enter your name" :class="styles.Input" />
            </div>
            <div :class="styles.Field">
              <label :for="feedbackId" :class="styles.Label">Feedback</label>
              <input
                :id="feedbackId"
                ref="initialFocus"
                required
                placeholder="Enter your feedback"
                :class="styles.Input"
              />
            </div>
          </div>
          <div :class="styles.Actions">
            <Dialog.Close :class="styles.Button">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <button ref="finalFocus" type="button" :class="styles.Button">Final focus</button>
  </div>
</template>
