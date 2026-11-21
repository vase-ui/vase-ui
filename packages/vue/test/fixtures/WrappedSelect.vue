<script setup lang="ts" generic="Value = never, Multiple extends boolean | undefined = false">
import { Select } from '../../src/select';
import type { SelectRootEmits, SelectRootProps } from '../../src/select';

interface Props extends /* @vue-ignore */ SelectRootProps<Value, Multiple> {}
interface Emits extends /* @vue-ignore */ SelectRootEmits<Value, Multiple> {}

defineProps<Props>();
defineEmits<Emits>();
</script>

<template>
  <Select.Root><slot /></Select.Root>
</template>
