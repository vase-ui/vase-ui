import SamplePopup from './popup/SamplePopup.vue';
import type { SamplePopupProps, SamplePopupState } from './popup/SamplePopup.vue';
import SampleRoot from './root/SampleRoot.vue';
import type { SampleRootProps, SampleRootState } from './root/SampleRoot.vue';

export const Root: typeof SampleRoot = SampleRoot;
export namespace Root {
  export type Props = SampleRootProps;
  export type State = SampleRootState;
}

export const Popup: typeof SamplePopup = SamplePopup;
export namespace Popup {
  export type Props = SamplePopupProps;
  export type State = SamplePopupState;
}

export interface Handle {
  open: () => void;
  close: () => void;
}

export function createHandle(): Handle {
  return { open() {}, close() {} };
}
