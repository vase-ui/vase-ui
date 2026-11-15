import { Checkbox } from '@vase-ui/vue/checkbox';
import { withProps } from './withProps';

export const Root = withProps(Checkbox.Root, {
  class:
    'flex size-4 shrink-0 items-center justify-center rounded-none border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:data-checked:bg-white dark:data-checked:text-neutral-950',
});

export const Indicator = withProps(Checkbox.Indicator, { class: 'flex data-unchecked:hidden' });
