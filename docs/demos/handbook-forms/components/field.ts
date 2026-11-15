import { Field } from '@vase-ui/vue/field';
import { withProps } from './withProps';

export const Root = withProps(Field.Root, { class: 'flex flex-col items-start gap-1' });

export const Label = withProps(Field.Label, {
  class:
    'text-sm font-bold text-neutral-950 has-[[role="checkbox"]]:flex has-[[role="checkbox"]]:items-center has-[[role="checkbox"]]:gap-2 has-[[role="checkbox"]]:font-normal has-[[role="radio"]]:flex has-[[role="radio"]]:items-center has-[[role="radio"]]:gap-2 has-[[role="radio"]]:font-normal has-[[role="switch"]]:flex has-[[role="switch"]]:items-center dark:text-white',
});

export const Description = withProps(Field.Description, {
  class: 'text-sm text-neutral-600 dark:text-neutral-400',
});

export const Control = withProps(Field.Control, {
  class:
    'h-8 w-full max-w-xs border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
});

export const Error = withProps(Field.Error, { class: 'text-sm text-red-700 dark:text-red-400' });

export const Item = Field.Item;
