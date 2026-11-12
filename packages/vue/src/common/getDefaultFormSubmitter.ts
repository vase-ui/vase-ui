export type DefaultFormSubmitter = HTMLButtonElement | HTMLInputElement;

// A disabled submitter can be the result.
// The browser selects the default button before it reads the disabled state.
export function getDefaultFormSubmitter(form: HTMLFormElement | null): DefaultFormSubmitter | null {
  if (!form) {
    return null;
  }

  for (const candidate of form.elements) {
    const tagName = candidate.tagName;

    if (tagName === 'BUTTON' || tagName === 'INPUT') {
      const button = candidate as HTMLButtonElement | HTMLInputElement;

      // This leaves out `input[type="image"]`, because Chromium omits it from `form.elements`.
      if (button.type === 'submit') {
        return button;
      }
    }
  }

  return null;
}
