import { Checkbox as CheckboxBase } from '@vase-ui/vue/checkbox';
import { withProps } from './withProps';

// The mark is an element beside the checkbox. `peer-checked` shows it.
export const Checkbox = withProps(CheckboxBase, {
  class:
    'peer m-0 size-4 shrink-0 appearance-none rounded-none border border-neutral-950 bg-white p-0 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:checked:bg-white',
});
