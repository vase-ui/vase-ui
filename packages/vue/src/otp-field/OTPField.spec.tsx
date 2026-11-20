import { expectType } from '#test-utils';
import {
  OTPField,
  type OTPFieldInputState,
  type OTPFieldRootChangeEventDetails,
  type OTPFieldRootCompleteEventDetails,
  type OTPFieldRootInvalidEventDetails,
  type OTPFieldRootProps,
  type OTPFieldRootState,
  type OTPFieldSeparatorProps,
} from '@vase-ui/vue/otp-field';

expectType<OTPFieldRootProps, OTPField.Root.Props>({} as OTPField.Root.Props);
expectType<OTPFieldRootState, OTPField.Root.State>({} as OTPField.Root.State);
expectType<OTPFieldInputState, OTPField.Input.State>({} as OTPField.Input.State);
expectType<OTPFieldSeparatorProps['orientation'], 'horizontal' | 'vertical' | undefined>(undefined);

// `event` narrows by `reason`.
<OTPField.Root
  length={6}
  onValueChange={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldRootChangeEventDetails, typeof details>(details);
    if (details.reason === 'input-paste')
      expectType<ClipboardEvent, typeof details.event>(details.event);
    if (details.reason === 'keyboard')
      expectType<KeyboardEvent, typeof details.event>(details.event);
  }}
  onValueInvalid={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldRootInvalidEventDetails, typeof details>(details);
    if (details.reason === 'input-paste')
      expectType<ClipboardEvent, typeof details.event>(details.event);
  }}
  onValueComplete={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldRootCompleteEventDetails, typeof details>(details);
    if (details.reason === 'input-paste')
      expectType<ClipboardEvent, typeof details.event>(details.event);
  }}
/>;

// @ts-expect-error `length` is required.
<OTPField.Root />;

<OTPField.Root
  length={6}
  validationType="none"
  inputmode="tel"
  autocomplete="off"
  readonly
  as="section"
/>;

// The attributes of a slot are the attributes of an input.
<OTPField.Input type="password" aria-label="Digit 2" autocomplete="off" />;

// @ts-expect-error The place of a slot comes from the document.
<OTPField.Input index={0} />;
