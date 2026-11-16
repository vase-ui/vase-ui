import { expectType } from '#test-utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { DialogRootChangeEventDetails } from '../root/DialogRoot.vue';
import { DialogStore } from './DialogStore';

const dialog = new DialogStore<unknown>(undefined, undefined);
dialog.setOpen(false, createChangeEventDetails(REASONS.closePress));
// @ts-expect-error A dialog has no swipe reason.
dialog.setOpen(false, createChangeEventDetails(REASONS.swipe));
// @ts-expect-error A dialog has no close watcher reason.
dialog.setOpen(false, createChangeEventDetails(REASONS.closeWatcher));
dialog.context.onOpenChange = (_open, details) => {
  expectType<DialogRootChangeEventDetails, typeof details>(details);
};
