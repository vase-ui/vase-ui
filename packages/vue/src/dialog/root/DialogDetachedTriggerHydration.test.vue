<script setup lang="ts">
import * as Dialog from '../index.parts';

const props = defineProps<{ handle?: Dialog.Handle<unknown> | undefined }>();

// A server render gets no handle, because the props go to the server as JSON.
const dialogHandle = props.handle ?? Dialog.createHandle();
</script>

<template>
  <Dialog.Root :handle="dialogHandle" default-open default-trigger-id="trigger" />
  <Dialog.Trigger :handle="dialogHandle" id="trigger">Trigger</Dialog.Trigger>
</template>
