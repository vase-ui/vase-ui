<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';

type CardContent = 'typography' | 'design' | 'art';

const demoPreviewCard = PreviewCard.createHandle<CardContent>();

const popupHiddenClass = '[transform:scale(0.98)] opacity-0';
const contentEnterFromClass =
  'opacity-0 group-data-[activation-direction~=left]:-translate-x-[30%] group-data-[activation-direction~=right]:translate-x-[30%]';
const contentLeavingClass = 'absolute top-0 left-0';
const contentLeaveToClass =
  'opacity-0 group-data-[activation-direction~=left]:translate-x-[30%] group-data-[activation-direction~=right]:-translate-x-[30%]';
</script>

<template>
  <div>
    <p class="text-base text-neutral-950 text-balance dark:text-white">
      Discover
      <PreviewCard.Trigger
        class="text-neutral-950 underline decoration-neutral-950/60 decoration-1 underline-offset-2 outline-0 hover:decoration-neutral-950 data-popup-open:decoration-neutral-950 focus-visible:no-underline focus-visible:outline-2 focus-visible:outline-neutral-950 dark:text-white dark:decoration-white/60 dark:hover:decoration-white dark:data-popup-open:decoration-white dark:focus-visible:outline-white"
        :handle="demoPreviewCard"
        href="https://en.wikipedia.org/wiki/Typography"
        payload="typography"
        >typography</PreviewCard.Trigger
      >,
      <PreviewCard.Trigger
        class="text-neutral-950 underline decoration-neutral-950/60 decoration-1 underline-offset-2 outline-0 hover:decoration-neutral-950 data-popup-open:decoration-neutral-950 focus-visible:no-underline focus-visible:outline-2 focus-visible:outline-neutral-950 dark:text-white dark:decoration-white/60 dark:hover:decoration-white dark:data-popup-open:decoration-white dark:focus-visible:outline-white"
        :handle="demoPreviewCard"
        href="https://en.wikipedia.org/wiki/Design"
        payload="design"
        >design</PreviewCard.Trigger
      >, or
      <PreviewCard.Trigger
        class="text-neutral-950 underline decoration-neutral-950/60 decoration-1 underline-offset-2 outline-0 hover:decoration-neutral-950 data-popup-open:decoration-neutral-950 focus-visible:no-underline focus-visible:outline-2 focus-visible:outline-neutral-950 dark:text-white dark:decoration-white/60 dark:hover:decoration-white dark:data-popup-open:decoration-white dark:focus-visible:outline-white"
        :handle="demoPreviewCard"
        href="https://en.wikipedia.org/wiki/Art"
        payload="art"
        >art</PreviewCard.Trigger
      >.
    </p>

    <PreviewCard.Root :handle="demoPreviewCard">
      <template #default="{ payload }">
        <PreviewCard.Portal>
          <PreviewCard.Positioner
            :side-offset="8"
            class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
              <PreviewCard.Popup
                class="relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[width,height,opacity,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
              >
                <PreviewCard.Arrow
                  class="relative block h-1.5 w-3 overflow-clip data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:absolute before:bottom-0 before:left-1/2 before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:border before:border-neutral-950 before:bg-white before:content-[''] before:[transform:translate(-50%,50%)_rotate(45deg)] dark:before:border-white dark:before:bg-neutral-950"
                />
                <PreviewCard.Viewport
                  v-slot="{ triggerId }"
                  class="group relative h-full w-full overflow-clip"
                >
                  <Transition
                    :enter-from-class="contentEnterFromClass"
                    :leave-active-class="contentLeavingClass"
                    :leave-to-class="contentLeaveToClass"
                  >
                    <div
                      :key="triggerId ?? ''"
                      class="w-[var(--popup-width)] transition-[translate,opacity] duration-[350ms,175ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    >
                      <div v-if="payload === 'typography'" class="flex w-min flex-col gap-2 p-2">
                        <img
                          width="224"
                          height="150"
                          class="block max-w-none"
                          src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
                          alt="Station Hofplein signage in Rotterdam, Netherlands"
                        />
                        <p class="text-sm">
                          <strong>Typography</strong> is the art and science of arranging type.
                        </p>
                      </div>
                      <div v-else-if="payload === 'design'" class="flex w-min flex-col gap-2 p-2">
                        <img
                          width="250"
                          height="249"
                          class="block max-w-none"
                          src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Braun_ABW30_%28schwarz%29.jpg/250px-Braun_ABW30_%28schwarz%29.jpg"
                          alt="Braun ABW30"
                        />
                        <p class="text-sm">
                          A <strong>design</strong> is the concept or proposal for an object,
                          process, or system.
                        </p>
                      </div>
                      <div v-else-if="payload === 'art'" class="flex w-min flex-col gap-2 p-2">
                        <img
                          width="250"
                          height="290"
                          class="block max-w-none"
                          src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/MonaLisa_sfumato.jpeg/250px-MonaLisa_sfumato.jpeg"
                          alt="Mona Lisa"
                        />
                        <p class="text-sm">
                          <strong>Art</strong> is a diverse range of cultural activity centered
                          around works utilizing creative or imaginative talents, which are expected
                          to evoke a worthwhile experience, generally through an expression of
                          emotional power, conceptual ideas, technical proficiency, or beauty.
                        </p>
                      </div>
                    </div>
                  </Transition>
                </PreviewCard.Viewport>
              </PreviewCard.Popup>
            </Transition>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </template>
    </PreviewCard.Root>
  </div>
</template>
