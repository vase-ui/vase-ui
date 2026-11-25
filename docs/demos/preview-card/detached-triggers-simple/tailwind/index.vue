<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';

const demoPreviewCard = PreviewCard.createHandle();

const popupHiddenClass = '[transform:scale(0.98)] opacity-0';
</script>

<template>
  <div>
    <p class="text-base text-neutral-950 text-balance dark:text-white">
      The principles of good
      <PreviewCard.Trigger
        class="text-neutral-950 underline decoration-neutral-950/60 decoration-1 underline-offset-2 outline-0 hover:decoration-neutral-950 data-popup-open:decoration-neutral-950 focus-visible:no-underline focus-visible:outline-2 focus-visible:outline-neutral-950 dark:text-white dark:decoration-white/60 dark:hover:decoration-white dark:data-popup-open:decoration-white dark:focus-visible:outline-white"
        :handle="demoPreviewCard"
        href="https://en.wikipedia.org/wiki/Typography"
        >typography</PreviewCard.Trigger
      >
      remain in the digital age.
    </p>

    <PreviewCard.Root :handle="demoPreviewCard">
      <PreviewCard.Portal>
        <PreviewCard.Positioner :side-offset="8">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <PreviewCard.Popup
              class="relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[transform,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <PreviewCard.Arrow
                class="relative block h-1.5 w-3 overflow-clip data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:absolute before:bottom-0 before:left-1/2 before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:border before:border-neutral-950 before:bg-white before:content-[''] before:[transform:translate(-50%,50%)_rotate(45deg)] dark:before:border-white dark:before:bg-neutral-950"
              />
              <div class="flex w-min flex-col gap-2 p-2">
                <img
                  width="224"
                  height="150"
                  class="block max-w-none"
                  src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
                  alt="Station Hofplein signage in Rotterdam, Netherlands"
                />
                <p class="text-sm">
                  <strong>Typography</strong> is the art and science of arranging type to make
                  written language clear, visually appealing, and effective in communication.
                </p>
              </div>
            </PreviewCard.Popup>
          </Transition>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  </div>
</template>
