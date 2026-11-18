import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../common/visuallyHidden';
import { handleHiddenInputInvalid } from './handleHiddenInputInvalid';

export function checkedInputProps(own: {
  type: 'checkbox' | 'radio';
  checked: boolean;
  disabled: boolean;
  form: string | undefined;
  id: string | undefined;
  name: string | undefined;
  required: boolean | undefined;
  onClick: (event: MouseEvent) => void;
  element: () => HTMLElement | null;
}) {
  return {
    checked: own.checked,
    disabled: own.disabled,
    form: own.form,
    id: own.id,
    name: own.name,
    required: own.required,
    style: own.name ? visuallyHiddenInput : visuallyHiddenInputPinned,
    tabindex: -1,
    type: own.type,
    'aria-hidden': true,
    onInvalid: handleHiddenInputInvalid,
    onClick: own.onClick,
    onFocusin() {
      own.element()?.focus();
    },
  };
}

export function restoreChecked(input: HTMLInputElement | null, checked: boolean, mixed?: boolean) {
  if (input && input.checked !== checked) {
    // eslint-disable-next-line no-restricted-syntax -- Vue skips an equal checked binding after the browser toggles the input.
    input.checked = checked;
  }
  if (input && mixed !== undefined && input.indeterminate !== mixed) {
    // eslint-disable-next-line no-restricted-syntax -- A click clears indeterminate and Vue skips an equal binding.
    input.indeterminate = mixed;
  }
}
