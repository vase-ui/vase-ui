<script setup vapor lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';

defineProps<{ open?: boolean | undefined }>();
</script>

<template>
  <AlertDialog.Root :open="open" />
</template>
