<script lang="ts">
import { Toast } from '@vase-ui/vue/toast';

// All requests of the server share a manager of a module.
const anchoredToastManager = Toast.createToastManager();
</script>

<script setup lang="ts">
import { useTemplateRef } from 'vue';

const anchor = useTemplateRef<HTMLButtonElement>('anchor');

function addAnchoredToast() {
  anchoredToastManager.add({
    title: 'Copied',
    positionerProps: { anchor: anchor.value, side: 'bottom', sideOffset: 8 },
  });
}
</script>

<template>
  <main>
    <Toast.Provider>
      <ToastAddButton />
      <Toast.Viewport data-testid="viewport">
        <ToastStack />
      </Toast.Viewport>
    </Toast.Provider>
    <Toast.Provider :toast-manager="anchoredToastManager">
      <button ref="anchor" data-testid="anchor" type="button" @click="addAnchoredToast">
        copy
      </button>
      <Toast.Portal>
        <Toast.Viewport data-testid="anchored-viewport">
          <ToastAnchoredStack />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  </main>
</template>
