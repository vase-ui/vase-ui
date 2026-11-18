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
