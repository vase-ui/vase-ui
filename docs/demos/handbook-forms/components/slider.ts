import { Slider } from '@vase-ui/vue/slider';
import { withProps } from './withProps';

export const Root = withProps(Slider.Root, { class: 'grid grid-cols-2' });

export const Value = withProps(Slider.Value, {
  class: 'text-sm font-normal text-neutral-950 dark:text-white',
});

export const Control = withProps(Slider.Control, {
  class: 'flex col-span-2 touch-none items-center py-3 select-none',
});

export const Track = withProps(Slider.Track, {
  class: 'h-1 w-full bg-neutral-200 select-none dark:bg-neutral-800',
});

export const Indicator = withProps(Slider.Indicator, {
  class: 'bg-neutral-950 select-none dark:bg-white',
});

export const Thumb = withProps(Slider.Thumb, {
  class:
    'size-4 border border-neutral-950 bg-white select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-950 dark:has-[:focus-visible]:outline-white dark:border-white dark:bg-neutral-950',
});
