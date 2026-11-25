<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';

const portalContainer = useTemplateRef<HTMLDivElement>('portalContainer');
</script>

<template>
  <div
    ref="portalContainer"
    class="relative min-h-80 w-full overflow-hidden border border-neutral-950 bg-white text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white"
  >
    <Drawer.Root swipe-direction="right" :modal="false">
      <Drawer.SwipeArea
        class="absolute inset-y-0 right-0 z-[1] w-10 border-l-2 border-dashed border-blue-800 bg-blue-800/10 dark:border-blue-500 dark:bg-blue-500/10"
      >
        <span
          class="pointer-events-none absolute right-0 top-1/2 z-0 mr-2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-xs font-bold tracking-[0.12em] text-blue-800 uppercase dark:text-blue-500"
          >Swipe here</span
        >
      </Drawer.SwipeArea>
      <div class="flex min-h-80 flex-col items-center justify-center gap-3 p-4 text-center">
        <p class="text-sm text-neutral-600 text-center dark:text-neutral-400 pr-12">
          Swipe from the right edge to open the drawer.
        </p>
      </div>
      <Drawer.Portal :to="portalContainer">
        <Transition
          enter-from-class="opacity-0!"
          leave-to-class="opacity-0!"
          leave-active-class="duration-[calc(var(--drawer-swipe-strength)*400ms)]!"
        >
          <Drawer.Backdrop
            class="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] absolute inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute"
          />
        </Transition>
        <Drawer.Viewport
          class="[--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem] absolute inset-0 z-20 flex items-stretch justify-end p-(--viewport-padding)"
        >
          <Transition
            enter-from-class="[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))]!"
            leave-to-class="[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))]!"
            leave-active-class="duration-[calc(var(--drawer-swipe-strength)*400ms)]!"
          >
            <Drawer.Popup
              class="[--bleed:3rem] supports-[-webkit-touch-callout:none]:[--bleed:0px] h-full w-[calc(20rem+3rem)] max-w-[calc(100vw-3rem+3rem)] -mr-[3rem] border-l border-neutral-950 bg-white p-6 pr-[calc(1.5rem+3rem)] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto touch-auto [transform:translateX(var(--drawer-swipe-movement-x))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-3rem)] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:pr-6 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <Drawer.Content class="mx-auto w-full max-w-[32rem]">
                <Drawer.Title class="mb-1 text-base font-bold">Library</Drawer.Title>
                <Drawer.Description class="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
                  Swipe from the edge whenever you want to jump back into your playlists.
                </Drawer.Description>
                <div class="flex justify-end gap-3">
                  <Drawer.Close
                    class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                    >Close</Drawer.Close
                  >
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  </div>
</template>
