import { expectType } from '#test-utils';
import { OTPField } from '@vase-ui/vue/otp-field';
import { REASONS } from '../../internals/reasons';

type OTPFieldChangeDetails = OTPField.Root.ChangeEventDetails;
type OTPFieldChangeHandler = (value: string, eventDetails: OTPFieldChangeDetails) => void;
type OTPFieldInvalidDetails = OTPField.Root.InvalidEventDetails;
type OTPFieldInvalidHandler = (value: string, eventDetails: OTPFieldInvalidDetails) => void;
type OTPFieldCompleteDetails = OTPField.Root.CompleteEventDetails;
type OTPFieldCompleteHandler = (value: string, eventDetails: OTPFieldCompleteDetails) => void;

function assertOTPFieldChange(details: OTPFieldChangeDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }

  if (details.reason === REASONS.inputClear) {
    const event: InputEvent | FocusEvent | Event = details.event;
    void event;
    // @ts-expect-error keyboard events are not emitted for input-clear
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }
}

const handleOTPFieldChange: OTPFieldChangeHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldChange(details);
};

function assertOTPFieldInvalid(details: OTPFieldInvalidDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }
}

const handleOTPFieldInvalid: OTPFieldInvalidHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldInvalid(details);
};

function assertOTPFieldComplete(details: OTPFieldCompleteDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }
}

const handleOTPFieldComplete: OTPFieldCompleteHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldComplete(details);
};

const otpFieldEventNarrowing = (
  <OTPField.Root
    length={6}
    form="verification-form"
    mask
    validationType="alphanumeric"
    normalizeValue={(value) => value.toUpperCase()}
    onValueChange={handleOTPFieldChange}
    onValueInvalid={handleOTPFieldInvalid}
    onValueComplete={handleOTPFieldComplete}
  />
);
void otpFieldEventNarrowing;

// The listeners of the part have the types of the handlers above.
<OTPField.Root
  length={6}
  onValueChange={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldChangeDetails, typeof details>(details);
  }}
  onValueInvalid={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldInvalidDetails, typeof details>(details);
  }}
  onValueComplete={(value, details) => {
    expectType<string, typeof value>(value);
    expectType<OTPFieldCompleteDetails, typeof details>(details);
  }}
/>;

// @ts-expect-error - length is required
const requiresLength = <OTPField.Root />;
void requiresLength;

const customInputModeWithCustomValidation = (
  <OTPField.Root length={6} validationType="none" inputMode="numeric" />
);
void customInputModeWithCustomValidation;

const customInputModeWithBuiltInValidation = (
  <OTPField.Root length={6} validationType="numeric" inputMode="tel" />
);
void customInputModeWithBuiltInValidation;

const nativeInputMode = (
  // @ts-expect-error - the prop is `inputMode`. The attribute `inputmode` goes to the group only.
  <OTPField.Root length={6} inputmode="numeric" />
);
void nativeInputMode;

const normalizesValue = (
  <OTPField.Root length={6} validationType="alphanumeric" normalizeValue={(value) => value} />
);
void normalizesValue;

const removedSanitizeValue = (
  // @ts-expect-error - sanitizeValue was renamed to normalizeValue
  <OTPField.Root length={6} validationType="alphanumeric" sanitizeValue={(value) => value} />
);
void removedSanitizeValue;
