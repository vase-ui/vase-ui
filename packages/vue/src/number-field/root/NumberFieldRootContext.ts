import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';
import type {
  NumberFieldRootChangeEventDetails,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootState,
} from './NumberFieldRoot.vue';

export type InputMode = 'numeric' | 'decimal' | 'text';

export interface NumberFieldRootContext {
  minWithDefault: ComputedRef<number>;
  maxWithDefault: ComputedRef<number>;
  id: ComputedRef<string>;
  form: ComputedRef<string | undefined>;
  setValue: (value: number | null, details: NumberFieldRootChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  /**
   * The element of the text input. `NumberField.Input` writes it.
   */
  inputRef: Ref<HTMLInputElement | null>;
  focusInput: () => void;
  /**
   * `false` while the text of the input holds an edit that is not a value yet.
   */
  allowInputSyncRef: Ref<boolean>;
  formatOptionsRef: ComputedRef<Intl.NumberFormatOptions | undefined>;
  valueRef: Ref<number | null>;
  lastChangedValueRef: Ref<number | null>;
  hasPendingCommitRef: Ref<boolean>;
  name: ComputedRef<string | undefined>;
  nameProp: ComputedRef<string | undefined>;
  inputMode: ComputedRef<InputMode>;
  getAllowedNonNumericKeys: () => Set<string>;
  min: ComputedRef<number | undefined>;
  max: ComputedRef<number | undefined>;
  setInputValue: (inputValue: string) => void;
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  setIsScrubbing: (scrubbing: boolean) => void;
  state: ComputedRef<NumberFieldRootState>;
  onValueCommitted: (value: number | null, eventDetails: NumberFieldRootCommitEventDetails) => void;
  /**
   * The handler of the `wheel` event of the text input. The input binds it as `onWheel` while
   * `isWheelScrubEnabled` is `true`.
   */
  onInputWheel: (event: WheelEvent) => void;
  isWheelScrubEnabled: ComputedRef<boolean>;
  /**
   * `true` while a native reset of the form changes the value. The root clears the error of the
   * field for that change, so the input must not validate the value of a reset.
   */
  isResetChangePending: Readonly<Ref<boolean>>;
}

export const NumberFieldRootContext: InjectionKey<NumberFieldRootContext> = Symbol();

export function useNumberFieldRootContext(): NumberFieldRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NumberFieldRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Number Field must be inside <NumberField.Root>. Without a root the part has no value to show. Put the part inside <NumberField.Root>.',
    );
  }

  return context;
}
