<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Popover } from '@vase-ui/vue/popover';

type Panel = 'shipping' | 'returns' | 'profile';

const demoPopover = Popover.createHandle<Panel>();

const XIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
      style: { display: 'block' },
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

// The viewport has the side of the new trigger in `data-activation-direction`.
const contentEnterFromClass =
  'opacity-0 group-data-[activation-direction~=left]:-translate-x-1/2 group-data-[activation-direction~=right]:translate-x-1/2';
const contentLeavingClass = 'absolute top-2 left-2';
const contentLeaveToClass =
  'opacity-0 group-data-[activation-direction~=left]:translate-x-1/2 group-data-[activation-direction~=right]:-translate-x-1/2';

const triggerClassName =
  'flex h-8 items-center justify-center border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm font-normal whitespace-nowrap text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:data-pressed:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white';

const popupHiddenClass = 'scale-90 opacity-0';
</script>

<template>
  <div class="flex gap-2">
    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" payload="shipping">
      Shipping
    </Popover.Trigger>

    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" payload="returns">
      Returns
    </Popover.Trigger>

    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" payload="profile">
      Profile
    </Popover.Trigger>

    <Popover.Root v-slot="{ payload }" :handle="demoPopover">
      <Popover.Portal>
        <Popover.Positioner
          :side-offset="8"
          class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none"
        >
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Popover.Popup
              class="relative flex h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] max-w-[31.25rem] flex-col gap-1 origin-[var(--transform-origin)] bg-white dark:bg-neutral-950 text-neutral-950 dark:text-white outline-none border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[width,height,opacity,scale] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none"
            >
              <Popover.Arrow
                class="relative block w-3 h-1.5 overflow-clip transition-[left] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:w-[calc(6px*sqrt(2))] before:h-[calc(6px*sqrt(2))] before:bg-white dark:before:bg-neutral-950 before:border before:border-neutral-950 dark:before:border-white before:[transform:translate(-50%,50%)_rotate(45deg)]"
              />

              <Popover.Viewport
                v-slot="{ triggerId }"
                class="group relative h-full w-full overflow-clip p-2"
              >
                <Transition
                  :enter-from-class="contentEnterFromClass"
                  :leave-active-class="contentLeavingClass"
                  :leave-to-class="contentLeaveToClass"
                >
                  <div
                    :key="triggerId ?? ''"
                    class="w-[calc(var(--popup-width)-1rem)] transition-[translate,opacity] duration-[350ms,175ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  >
                    <div v-if="payload === 'shipping'" class="flex flex-col gap-1">
                      <Popover.Title class="pr-8 text-sm font-bold">Free shipping</Popover.Title>
                      <Popover.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                        Orders over $50 arrive in 3–5 business days at no extra cost.
                      </Popover.Description>
                    </div>
                    <div v-else-if="payload === 'returns'" class="flex flex-col gap-1">
                      <Popover.Title class="pr-8 text-sm font-bold">Free returns</Popover.Title>
                      <Popover.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                        Return any item within 30 days for a full refund.
                      </Popover.Description>
                    </div>
                    <div
                      v-else-if="payload === 'profile'"
                      class="grid w-max grid-cols-[auto_auto] gap-x-2"
                    >
                      <Popover.Title
                        class="col-start-2 col-end-3 row-start-1 row-end-2 pr-8 text-sm font-bold"
                        >Jason Eventon</Popover.Title
                      >
                      <img
                        src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
                        width="48"
                        height="48"
                        alt=""
                        class="col-start-1 col-end-2 row-start-1 row-end-3 h-12 w-12 object-cover bg-neutral-200 dark:bg-neutral-800"
                      />
                      <span
                        class="col-start-2 col-end-3 row-start-2 row-end-3 text-sm text-neutral-600 dark:text-neutral-400"
                        >Pro plan</span
                      >
                      <div
                        class="col-start-1 col-end-3 row-start-3 row-end-4 flex flex-col gap-2 pt-2 text-sm"
                      >
                        <a
                          href="#"
                          class="text-neutral-950 dark:text-white underline underline-offset-[0.16em] decoration-[1px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                          >Profile settings</a
                        >
                        <a
                          href="#"
                          class="text-neutral-950 dark:text-white underline underline-offset-[0.16em] decoration-[1px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                          >Log out</a
                        >
                      </div>
                    </div>
                  </div>
                </Transition>
              </Popover.Viewport>

              <Popover.Close
                aria-label="Close"
                class="absolute top-1 right-1 flex size-7 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
              >
                <XIcon />
              </Popover.Close>
            </Popover.Popup>
          </Transition>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>
</template>
