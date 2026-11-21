<script setup lang="ts" generic="Payload = unknown">
import { Dialog } from '../../src/dialog';
import type { DialogRootEmits, DialogRootProps } from '../../src/dialog';

interface Props extends /* @vue-ignore */ DialogRootProps<Payload> {}
interface Emits extends /* @vue-ignore */ DialogRootEmits {}

defineProps<Props>();
defineEmits<Emits>();
</script>

<template>
  <Dialog.Root><slot /></Dialog.Root>
</template>
