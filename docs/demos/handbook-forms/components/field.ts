import { Field } from '@vase-ui/vue/field';
import { withProps } from './withProps';

export const Root = withProps(Field.Root, { class: 'flex flex-col items-start gap-1' });

export const Label = withProps(Field.Label, {
  class:
    'text-sm font-bold text-neutral-950 has-[[type=checkbox]]:flex has-[[type=checkbox]]:items-center has-[[type=checkbox]]:gap-2 has-[[type=checkbox]]:font-normal has-[[type=radio]]:flex has-[[type=radio]]:items-center has-[[type=radio]]:gap-2 has-[[type=radio]]:font-normal dark:text-white',
});

export const Description = withProps(Field.Description, {
  class: 'text-sm text-neutral-600 dark:text-neutral-400',
});

export const Error = withProps(Field.Error, { class: 'text-sm text-red-700 dark:text-red-400' });

export const Item = Field.Item;
