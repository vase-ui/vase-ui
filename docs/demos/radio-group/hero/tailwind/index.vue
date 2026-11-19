<script setup lang="ts">
import { useId } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

const captionId = useId();
</script>

<template>
  <RadioGroup
    :aria-labelledby="captionId"
    default-value="fuji-apple"
    class="flex flex-col items-start gap-1 text-neutral-950 dark:text-white"
  >
    <div class="text-sm font-bold" :id="captionId">Best apple</div>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <Radio
        value="fuji-apple"
        class="m-0 size-4 shrink-0 appearance-none rounded-full border border-neutral-950 bg-white p-0 checked:bg-neutral-950 checked:shadow-[inset_0_0_0_0.1875rem_white] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:checked:shadow-[inset_0_0_0_0.1875rem_var(--color-neutral-950)] dark:focus-visible:outline-white"
      />
      Fuji
    </label>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <Radio
        value="gala-apple"
        class="m-0 size-4 shrink-0 appearance-none rounded-full border border-neutral-950 bg-white p-0 checked:bg-neutral-950 checked:shadow-[inset_0_0_0_0.1875rem_white] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:checked:shadow-[inset_0_0_0_0.1875rem_var(--color-neutral-950)] dark:focus-visible:outline-white"
      />
      Gala
    </label>

    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <Radio
        value="granny-smith-apple"
        class="m-0 size-4 shrink-0 appearance-none rounded-full border border-neutral-950 bg-white p-0 checked:bg-neutral-950 checked:shadow-[inset_0_0_0_0.1875rem_white] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:checked:shadow-[inset_0_0_0_0.1875rem_var(--color-neutral-950)] dark:focus-visible:outline-white"
      />
      Granny Smith
    </label>
  </RadioGroup>
</template>
