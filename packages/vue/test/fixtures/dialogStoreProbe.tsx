import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import { useDialogRootContext } from '../../src/dialog/root/DialogRootContext';
import type { DialogStore } from '../../src/dialog/store/DialogStore';

/**
 * A fixture part that gives the store of the root above it to the test, as each part of the
 * family reads it.
 */
export const DialogStoreProbe = defineComponent({
  props: {
    onStore: { type: Function as PropType<(store: DialogStore<unknown>) => void>, required: true },
  },
  setup(props) {
    props.onStore(useDialogRootContext());
    return () => null;
  },
});
