import { Drawer } from '@vase-ui/vue/drawer';
import { Dialog } from '@vase-ui/vue/dialog';

const numberPayloadHandle = Drawer.createHandle<number>();
const dialogHandle = Dialog.createHandle<number>();

<Drawer.Trigger handle={numberPayloadHandle} payload={42} />;
<Drawer.Trigger handle={numberPayloadHandle} />;
// @ts-expect-error The handle requires a number payload, not a string.
<Drawer.Trigger handle={numberPayloadHandle} payload={'invalid'} />;
// @ts-expect-error A handle of Dialog is not a handle of Drawer.
<Drawer.Trigger handle={dialogHandle} />;
