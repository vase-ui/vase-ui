<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
import { HeadphonesIcon, StopwatchIcon, TrashIcon } from '../../icons-tw';

const demoTooltip = Tooltip.createHandle<string>();

const triggerClass =
  'flex size-8 items-center justify-center border border-neutral-950 bg-white text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white focus-visible:relative hover:bg-neutral-100 active:bg-neutral-200 dark:border-white dark:bg-neutral-950 dark:text-white dark:data-popup-open:bg-neutral-800 dark:hover:bg-neutral-800 dark:active:bg-neutral-700';
const arrowClass =
  "relative block w-3 h-1.5 overflow-clip transition-[left] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:w-[calc(6px*sqrt(2))] before:h-[calc(6px*sqrt(2))] before:bg-white dark:before:bg-neutral-950 before:border before:border-neutral-950 dark:before:border-white before:[transform:translate(-50%,50%)_rotate(45deg)]";

// The viewport has the side of the new trigger in `data-activation-direction`.
const contentEnterFromClass =
  'opacity-0 group-data-[activation-direction~=left]:-translate-x-1/2 group-data-[activation-direction~=right]:translate-x-1/2';
const contentLeavingClass = 'absolute top-1 left-2';
const contentLeaveToClass =
  'opacity-0 group-data-[activation-direction~=left]:translate-x-1/2 group-data-[activation-direction~=right]:-translate-x-1/2';
const popupHiddenClass = 'opacity-0 [transform:scale(0.9)]';
</script>

<template>
  <Tooltip.Provider>
    <div class="flex">
      <Tooltip.Trigger
        :class="triggerClass"
        :handle="demoTooltip"
        payload="Listen to audio preview"
        aria-label="Listen to audio preview"
      >
        <HeadphonesIcon aria-hidden="true" />
      </Tooltip.Trigger>

      <Tooltip.Trigger
        :class="[triggerClass, 'border-l-0']"
        :handle="demoTooltip"
        payload="Set a timer"
        aria-label="Set a timer"
      >
        <StopwatchIcon aria-hidden="true" />
      </Tooltip.Trigger>

      <Tooltip.Trigger
        :class="[triggerClass, 'border-l-0']"
        :handle="demoTooltip"
        payload="Delete: This action cannot be undone"
        aria-label="Delete: This action cannot be undone"
      >
        <TrashIcon aria-hidden="true" />
      </Tooltip.Trigger>
    </div>

    <Tooltip.Root v-slot="{ payload }" :handle="demoTooltip">
      <Tooltip.Portal>
        <Tooltip.Positioner
          :side-offset="11"
          class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none"
        >
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Tooltip.Popup
              class="relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] max-w-[500px] border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 text-sm text-neutral-950 dark:text-white origin-[var(--transform-origin)] shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[width,height,opacity,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none"
            >
              <Tooltip.Arrow :class="arrowClass" />

              <Tooltip.Viewport
                v-slot="{ triggerId }"
                class="group relative h-full w-full overflow-clip px-2 py-1"
              >
                <Transition
                  :enter-from-class="contentEnterFromClass"
                  :leave-active-class="contentLeavingClass"
                  :leave-to-class="contentLeaveToClass"
                >
                  <div
                    :key="triggerId ?? ''"
                    class="w-[calc(var(--popup-width)-1rem)] transition-[translate,opacity] duration-[350ms,175ms] ease-[cubic-bezier(0.22,1,0.36,1)] [[data-instant]_&]:transition-none"
                  >
                    {{ payload }}
                  </div>
                </Transition>
              </Tooltip.Viewport>
            </Tooltip.Popup>
          </Transition>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
</template>
