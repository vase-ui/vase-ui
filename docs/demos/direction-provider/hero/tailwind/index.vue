<script setup lang="ts">
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <div dir="rtl">
    <DirectionProvider direction="rtl">
      <Slider.Root :default-value="25" dir="rtl">
        <Slider.Control class="flex w-56 touch-none items-center py-3 select-none">
          <Slider.Track class="h-1 w-full bg-neutral-200 select-none dark:bg-neutral-800">
            <Slider.Indicator class="bg-neutral-950 select-none dark:bg-white" />
            <Slider.Thumb
              aria-label="Volume"
              class="size-4 border border-neutral-950 bg-white select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-950 dark:has-[:focus-visible]:outline-white dark:border-white dark:bg-neutral-950"
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </DirectionProvider>
  </div>
</template>
