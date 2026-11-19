<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Fieldset } from '@vase-ui/vue/fieldset';
</script>

<template>
  <Fieldset.Root class="flex w-full max-w-64 flex-col gap-4">
    <Fieldset.Legend
      class="border-b border-neutral-950 text-base font-bold text-neutral-950 dark:border-white dark:text-white"
      >Billing details</Fieldset.Legend
    >

    <Field.Root class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Company</Field.Label>
      <Input
        placeholder="Enter company name"
        class="h-8 w-full border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
    </Field.Root>

    <Field.Root class="flex flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Tax ID</Field.Label>
      <Input
        placeholder="Enter fiscal number"
        class="h-8 w-full border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
    </Field.Root>
  </Fieldset.Root>
</template>
