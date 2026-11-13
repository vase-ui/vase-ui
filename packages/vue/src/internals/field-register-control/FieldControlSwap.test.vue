<script setup lang="ts">
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';

// In the field `b`, the new control comes before the old control. When `swapped` changes, a compiled
// template mounts the new control before it unmounts the old control.
defineProps<{
  swapped: boolean;
}>();

const emit = defineEmits<{
  submit: [fields: { name: string | undefined; value: unknown; valid: boolean | null }[]];
}>();
</script>

<template>
  <FormScope data-testid="form" @submit="emit('submit', $event)">
    <FieldScope name="a">
      <FieldControlPart id="a" value="first" />
    </FieldScope>
    <FieldScope name="b">
      <FieldControlPart v-if="swapped" id="b-new" value="new" />
      <FieldControlPart v-if="!swapped" id="b-old" value="old" />
    </FieldScope>
    <FieldScope name="c">
      <FieldControlPart id="c" value="last" />
    </FieldScope>
  </FormScope>
</template>
