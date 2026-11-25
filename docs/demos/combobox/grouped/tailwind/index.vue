<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';

const id = useId();

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

const XIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

const CaretDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [h('path', { d: 'M12 6H4l4 4.5z' })]);

interface Produce {
  id: string;
  label: string;
  group: 'Fruits' | 'Vegetables';
}

interface ProduceGroup {
  value: string;
  items: Produce[];
}

const produceData: Produce[] = [
  { id: 'fruit-apple', label: 'Apple', group: 'Fruits' },
  { id: 'fruit-banana', label: 'Banana', group: 'Fruits' },
  { id: 'fruit-mango', label: 'Mango', group: 'Fruits' },
  { id: 'fruit-kiwi', label: 'Kiwi', group: 'Fruits' },
  { id: 'fruit-grape', label: 'Grape', group: 'Fruits' },
  { id: 'fruit-orange', label: 'Orange', group: 'Fruits' },
  { id: 'fruit-strawberry', label: 'Strawberry', group: 'Fruits' },
  { id: 'fruit-watermelon', label: 'Watermelon', group: 'Fruits' },
  { id: 'veg-broccoli', label: 'Broccoli', group: 'Vegetables' },
  { id: 'veg-carrot', label: 'Carrot', group: 'Vegetables' },
  { id: 'veg-cauliflower', label: 'Cauliflower', group: 'Vegetables' },
  { id: 'veg-cucumber', label: 'Cucumber', group: 'Vegetables' },
  { id: 'veg-kale', label: 'Kale', group: 'Vegetables' },
  { id: 'veg-pepper', label: 'Bell pepper', group: 'Vegetables' },
  { id: 'veg-spinach', label: 'Spinach', group: 'Vegetables' },
  { id: 'veg-zucchini', label: 'Zucchini', group: 'Vegetables' },
];

function groupProduce(items: Produce[]): ProduceGroup[] {
  const groups: Record<string, Produce[]> = {};
  items.forEach((item) => {
    (groups[item.group] ??= []).push(item);
  });
  const order = ['Fruits', 'Vegetables'];
  return order.map((value) => ({ value, items: groups[value] ?? [] }));
}

const groupedProduce: ProduceGroup[] = groupProduce(produceData);

const popupHiddenClass = 'scale-95 opacity-0';
</script>

<template>
  <Combobox.Root :items="groupedProduce">
    <div
      class="relative flex flex-col gap-1 text-sm leading-5 font-bold text-neutral-950 dark:text-white"
    >
      <label :for="id">Select produce</label>
      <Combobox.InputGroup
        class="relative h-8 w-64 border border-neutral-950 bg-white dark:bg-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:focus-within:outline-white dark:border-white [&>input]:pr-[calc(0.5rem+2rem)] has-[.combobox-clear]:[&>input]:pr-[calc(0.5rem+2rem*2)]"
      >
        <Combobox.Input
          placeholder="e.g. Mango"
          class="h-full w-full border-0 bg-white pl-2 dark:bg-neutral-950 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400 dark:text-white"
          :id="id"
        />
        <div
          class="absolute right-0 bottom-0 flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400"
        >
          <Combobox.Clear
            class="combobox-clear flex h-full w-6 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white"
            aria-label="Clear selection"
          >
            <XIcon />
          </Combobox.Clear>
          <Combobox.Trigger
            class="flex h-full w-6 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white"
            aria-label="Open popup"
          >
            <CaretDownIcon />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
    </div>

    <Combobox.Portal>
      <Combobox.Positioner class="outline-none" :side-offset="4">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
          <Combobox.Popup
            class="w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0_rgb(0_0_0_/_12%)] transition-[scale,opacity] duration-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <Combobox.Empty>
              <div class="py-4 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                No produce found.
              </div>
            </Combobox.Empty>
            <Combobox.List
              class="max-h-[min(22.5rem,var(--available-height))] overflow-auto overscroll-contain py-1 scroll-py-1 outline-0"
            >
              <template #item="{ item: group }">
                <Combobox.Group class="block pb-2 last:pb-0">
                  <Combobox.GroupLabel
                    class="py-2 pr-2 pl-8 text-sm leading-4 text-neutral-500 select-none dark:text-neutral-400"
                  >
                    {{ group.value }}
                  </Combobox.GroupLabel>
                  <template v-for="item in group.items" :key="item.value">
                    <Combobox.Item
                      v-slot="{ state }"
                      class="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 p-2 text-sm leading-4 outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      :value="item"
                    >
                      <span
                        v-if="state.selected"
                        class="col-start-1 flex items-center justify-center"
                      >
                        <CheckIcon />
                      </span>
                      <span class="col-start-2">{{ item.label }}</span>
                    </Combobox.Item>
                  </template>
                </Combobox.Group>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Transition>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
