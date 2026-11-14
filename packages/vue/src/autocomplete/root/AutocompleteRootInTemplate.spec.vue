<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Autocomplete } from '@vase-ui/vue/autocomplete';

interface Tag {
  id: number;
}

function onTagHighlighted(
  value: Tag | undefined,
  eventDetails: Autocomplete.Root.HighlightEventDetails,
) {
  return value?.id ?? eventDetails.reason;
}
</script>

<template>
  <Autocomplete.Root @item-highlighted="onTagHighlighted" />
  <Autocomplete.Root @item-highlighted.once="onTagHighlighted" />
  <Autocomplete.Root @item-highlighted="(value) => expectType<undefined, typeof value>(value)" />
  <Autocomplete.Root
    :items="[{ id: 1 }]"
    @item-highlighted="(value) => expectType<{ id: number } | undefined, typeof value>(value)"
  />
  <!-- @vue-expect-error The highlight can be cleared, so the value can be `undefined`. -->
  <Autocomplete.Root @item-highlighted="(value: Tag) => value" />
</template>
