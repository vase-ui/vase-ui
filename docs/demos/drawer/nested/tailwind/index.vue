<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';

const popupClassName =
  "[--bleed:3rem] [--peek:1rem] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-step:0.05] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--scale-base:calc(max(0,1-(var(--nested-drawers)*var(--stack-step))))] [--scale:clamp(0,calc(var(--scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--shrink:calc(1-var(--scale))] [--height:max(0px,calc(var(--drawer-frontmost-height,var(--drawer-height))-var(--bleed)))] group/popup relative -mx-px -mb-[3rem] w-[calc(100%+2px)] max-h-[calc(80%+3rem)] supports-[-webkit-touch-callout:none]:max-h-[calc(80vh+3rem)] [height:var(--drawer-height,auto)] border border-neutral-950 border-b-0 bg-white px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px)+3rem)] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto overscroll-contain touch-auto [transform-origin:50%_calc(100%-var(--bleed))] [transform:translateY(calc(var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--shrink)*var(--height))))_scale(var(--scale))] after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:content-[''] after:transition-[background-color] after:duration-[450ms] after:ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-swiping:duration-0 data-nested-drawer-swiping:duration-0 data-nested-drawer-open:h-[calc(var(--height)+var(--bleed))] data-nested-drawer-open:overflow-hidden data-nested-drawer-open:after:bg-black/5 dark:border-white dark:border-b-0 dark:bg-neutral-950 dark:text-white dark:shadow-none [transition:transform_450ms_cubic-bezier(0.32,0.72,0,1),height_450ms_cubic-bezier(0.32,0.72,0,1),opacity_450ms_cubic-bezier(0.32,0.72,0,1)]";

const popupHiddenClass = '[transform:translateY(calc(100%-var(--bleed)+2px))]!';

const popupLeavingClass =
  'opacity-[0.9999]! duration-[calc(var(--drawer-swipe-strength)*400ms)]! data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]! data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]!';

const contentClassName =
  'mx-auto w-full max-w-[32rem] transition-opacity duration-[300ms] ease-[cubic-bezier(0.45,1.005,0,1.005)] group-data-nested-drawer-open/popup:opacity-0 group-data-nested-drawer-swiping/popup:opacity-100';

const handleClassName =
  'mx-auto mb-4 h-1 w-12 bg-neutral-300 transition-opacity duration-[200ms] group-data-nested-drawer-open/popup:opacity-0 group-data-nested-drawer-swiping/popup:opacity-100 dark:bg-neutral-700';
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >Open drawer stack</Drawer.Trigger
    >
    <Drawer.Portal>
      <Transition
        enter-from-class="opacity-0!"
        leave-to-class="opacity-0!"
        leave-active-class="duration-[calc(var(--drawer-swipe-strength)*400ms)]!"
        appear
      >
        <Drawer.Backdrop
          class="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] fixed inset-0 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute supports-[-webkit-touch-callout:none]:min-h-dvh"
        />
      </Transition>
      <Drawer.Viewport class="fixed inset-0 flex items-end justify-center">
        <Transition
          :enter-from-class="popupHiddenClass"
          :leave-to-class="popupHiddenClass"
          :leave-active-class="popupLeavingClass"
          appear
        >
          <Drawer.Popup :class="popupClassName">
            <div :class="handleClassName" />
            <Drawer.Content :class="contentClassName">
              <Drawer.Title class="mb-1 text-base font-bold text-center">Account</Drawer.Title>
              <Drawer.Description
                class="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400"
              >
                Nested drawers can be styled to stack, while each drawer remains independently focus
                managed.
              </Drawer.Description>

              <div class="flex items-center justify-end gap-4">
                <div class="mr-auto">
                  <Drawer.Root>
                    <Drawer.Trigger
                      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                      >Security settings</Drawer.Trigger
                    >
                    <Drawer.Portal>
                      <Drawer.Viewport class="fixed inset-0 flex items-end justify-center">
                        <Transition
                          :enter-from-class="popupHiddenClass"
                          :leave-to-class="popupHiddenClass"
                          :leave-active-class="popupLeavingClass"
                          appear
                        >
                          <Drawer.Popup :class="popupClassName">
                            <div :class="handleClassName" />
                            <Drawer.Content :class="contentClassName">
                              <Drawer.Title class="mb-1 text-base font-bold text-center"
                                >Security</Drawer.Title
                              >
                              <Drawer.Description
                                class="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400"
                              >
                                Review sign-in activity and update your security preferences.
                              </Drawer.Description>

                              <ul
                                class="mb-6 list-disc pl-5 text-neutral-700 dark:text-neutral-300"
                              >
                                <li>Passkeys enabled</li>
                                <li>2FA via authenticator app</li>
                                <li>3 signed-in devices</li>
                              </ul>

                              <div class="flex items-center justify-end gap-4">
                                <div class="mr-auto">
                                  <Drawer.Root>
                                    <Drawer.Trigger
                                      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                    >
                                      Advanced options
                                    </Drawer.Trigger>
                                    <Drawer.Portal>
                                      <Drawer.Viewport
                                        class="fixed inset-0 flex items-end justify-center"
                                      >
                                        <Transition
                                          :enter-from-class="popupHiddenClass"
                                          :leave-to-class="popupHiddenClass"
                                          :leave-active-class="popupLeavingClass"
                                          appear
                                        >
                                          <Drawer.Popup :class="popupClassName">
                                            <div :class="handleClassName" />
                                            <Drawer.Content :class="contentClassName">
                                              <Drawer.Title
                                                class="mb-1 text-base font-bold text-center"
                                                >Advanced</Drawer.Title
                                              >
                                              <Drawer.Description
                                                class="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400"
                                              >
                                                This drawer is taller to demonstrate variable-height
                                                stacking.
                                              </Drawer.Description>

                                              <div class="grid gap-2 mb-4">
                                                <label
                                                  class="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                                                  for="device-name-tw"
                                                >
                                                  Device name
                                                </label>
                                                <input
                                                  id="device-name-tw"
                                                  class="h-8 w-full border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                                  value="Personal laptop"
                                                />
                                              </div>

                                              <div class="grid gap-2 mb-4">
                                                <label
                                                  class="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                                                  for="notes-tw"
                                                  >Notes</label
                                                >
                                                <textarea
                                                  id="notes-tw"
                                                  class="min-h-32 w-full resize-y border border-neutral-950 bg-white p-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                                  value="Rotate recovery codes and revoke older sessions."
                                                  rows="3"
                                                />
                                              </div>

                                              <div class="flex justify-end">
                                                <Drawer.Close
                                                  class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                                  >Done</Drawer.Close
                                                >
                                              </div>
                                            </Drawer.Content>
                                          </Drawer.Popup>
                                        </Transition>
                                      </Drawer.Viewport>
                                    </Drawer.Portal>
                                  </Drawer.Root>
                                </div>

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
</template>
