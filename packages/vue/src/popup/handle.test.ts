import { describe, expect, test } from 'vitest';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Popover } from '@vase-ui/vue/popover';
import { takeReportedMessages } from '../../test/reportedMessages';

const noRoot = (method: string) =>
  `console.warn: Vase UI: \`${method}()\` of a handle found no mounted root with this handle. The call does nothing.`;

describe('a handle in a development build', () => {
  test('open() and openWithPayload() with no mounted root warn one time for each text and do nothing', () => {
    const popover = Popover.createHandle();
    popover.open('trigger');
    popover.open('trigger');
    const dialog = Dialog.createHandle();
    dialog.open(null);
    dialog.openWithPayload('payload');
    Drawer.createHandle().openWithPayload('payload');
    expect(popover.isOpen).toBe(false);
    expect(dialog.isOpen).toBe(false);
    expect(takeReportedMessages()).toEqual([noRoot('open'), noRoot('openWithPayload')]);
  });
});
