import { Radio as RadioBase } from '@vase-ui/vue/radio';
import { withProps } from './withProps';

// An inner ring leaves a dot in the middle of a checked radio.
export const Radio = withProps(RadioBase, {
  class:
    'm-0 size-4 shrink-0 appearance-none rounded-full border border-neutral-950 bg-white p-0 checked:bg-neutral-950 checked:shadow-[inset_0_0_0_0.1875rem_white] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:checked:shadow-[inset_0_0_0_0.1875rem_var(--color-neutral-950)]',
});
