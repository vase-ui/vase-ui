import type { Component, HTMLAttributes } from 'vue';
import type { AsTag } from 'motion-v';
import { expectType } from '#test-utils';
import type { ComboboxChipProps } from '../combobox/chip/ComboboxChip.vue';
import type { ComboboxInputProps } from '../combobox/input/ComboboxInput.vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';

// The import of `motion-v` adds the options of `motion-v` to `HTMLAttributes`, `as` among them.
expectType<AsTag | undefined, HTMLAttributes['as']>(undefined);

expectType<false, 'as' extends keyof WithVaseUIEvent<HTMLAttributes> ? true : false>(false);

// Without the omit of `as`, TypeScript reports TS2320 on this line: the two parents declare `as`
// with different types.
interface PartProps extends VaseUIComponentProps<object>, WithVaseUIEvent<HTMLAttributes> {
  active?: boolean;
}

declare const partProps: PartProps;
expectType<string | Component | undefined, typeof partProps.as>(partProps.as);

expectType<string | undefined, WithVaseUIEvent<HTMLAttributes>['aria-description']>(undefined);

// A props object gets the check that vue-tsc makes for a template under `strictTemplates`.
export const describedChip: ComboboxChipProps = {
  'aria-description': 'Press Backspace or Delete to remove',
};
// The attributes type of `Combobox.Input` is an `Omit` of the shared type.
export const describedInput: ComboboxInputProps = { 'aria-description': 'Press Backspace' };
// @ts-expect-error A key with a spelling error is not an attribute.
export const misspelledChip: ComboboxChipProps = { 'aria-descripton': 'Press Backspace' };
// @ts-expect-error `aria-description` is a string.
export const numberChip: ComboboxChipProps = { 'aria-description': 5 };
