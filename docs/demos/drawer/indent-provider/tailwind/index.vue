<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';

const portalContainer = useTemplateRef<HTMLDivElement>('portalContainer');
</script>

<template>
  <Drawer.Provider>
    <div ref="portalContainer" class="[--bleed:3rem] relative w-full overflow-hidden">
      <Drawer.IndentBackground class="absolute inset-0 bg-black dark:bg-neutral-300" />
      <Drawer.Indent
        class="[--indent-radius:calc(1rem*(1-var(--drawer-swipe-progress)))] [--indent-transition:calc(1-clamp(0,calc(var(--drawer-swipe-progress)*100000),1))] relative min-h-80 border border-neutral-950 bg-white p-4 text-neutral-950 [transition:transform_0.4s_cubic-bezier(0.32,0.72,0,1),border-radius_0.25s_cubic-bezier(0.32,0.72,0,1)] origin-[center_top] will-change-transform [transform:scale(1)_translateY(0)] [transition-duration:calc(400ms*var(--indent-transition)),calc(250ms*var(--indent-transition))] data-active:transform-[scale(calc(0.98+(0.02*var(--drawer-swipe-progress))))_translateY(calc(0.5rem*(1-var(--drawer-swipe-progress))))] data-active:rounded-tl-(--indent-radius) data-active:rounded-tr-(--indent-radius) dark:border-white dark:bg-neutral-950 dark:text-white"
      >
        <div class="flex min-h-80 items-center justify-center">
          <Drawer.Root :modal="false">
            <Drawer.Trigger
              class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
              >Open drawer</Drawer.Trigger
            >
            <Drawer.Portal :to="portalContainer">
              <Transition
                enter-from-class="opacity-0!"
                leave-to-class="opacity-0!"
                leave-active-class="duration-[calc(var(--drawer-swipe-strength)*400ms)]!"
                appear
              >
                <Drawer.Backdrop
                  class="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] absolute inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute"
                />
              </Transition>
              <Drawer.Viewport class="absolute inset-0 flex items-end justify-center">
                <Transition
                  enter-from-class="[transform:translateY(calc(100%-var(--bleed)+2px))]!"
                  leave-to-class="[transform:translateY(calc(100%-var(--bleed)+2px))]!"
                  leave-active-class="duration-[calc(var(--drawer-swipe-strength)*400ms)]!"
                  appear
                >
                  <Drawer.Popup
                    class="w-full max-h-[calc(80vh+var(--bleed))] -mb-[var(--bleed)] border-t border-neutral-950 bg-white px-6 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px)+var(--bleed))] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto overscroll-contain transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [transform:translateY(var(--drawer-swipe-movement-y))] data-swiping:select-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
                  >
                    <div class="mx-auto mb-4 h-1 w-12 bg-neutral-300 dark:bg-neutral-700" />
                    <Drawer.Content class="mx-auto w-full max-w-[32rem]">
                      <Drawer.Title class="mt-0 mb-1 text-base font-bold text-center"
                        >Notifications</Drawer.Title
                      >
                      <Drawer.Description
                        class="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400"
                      >
                        You are all caught up. Good job!
                      </Drawer.Description>
                      <div class="flex justify-center gap-3">
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
      </Drawer.Indent>
    </div>
  </Drawer.Provider>
</template>
