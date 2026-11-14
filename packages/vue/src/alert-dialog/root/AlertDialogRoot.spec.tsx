import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { expectType } from '#test-utils';
import * as Dialog from '../../dialog/index.parts';

const numberPayloadHandle = AlertDialog.createHandle<number>();
const dialogHandle = Dialog.createHandle<number>();

<AlertDialog.Root handle={numberPayloadHandle}>
  <AlertDialog.Portal />
</AlertDialog.Root>;

<AlertDialog.Root
  handle={numberPayloadHandle}
  v-slots={{
    default: ({ payload }: { payload: number | undefined }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    },
  }}
/>;

<AlertDialog.Trigger handle={numberPayloadHandle} payload={42} />;
<AlertDialog.Trigger handle={numberPayloadHandle} />;

// @ts-expect-error The handle requires a number payload, not a string.
<AlertDialog.Trigger handle={numberPayloadHandle} payload={'invalid'} />;

// @ts-expect-error Dialog handles cannot be used for alert dialogs.
<AlertDialog.Root handle={dialogHandle}>
  <AlertDialog.Portal />
</AlertDialog.Root>;

// @ts-expect-error Dialog handles cannot be used for alert dialog triggers.
<AlertDialog.Trigger handle={dialogHandle} />;
