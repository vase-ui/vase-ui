import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Toast } from '@vase-ui/vue/toast';
import { Tooltip } from '@vase-ui/vue/tooltip';
import type { ShallowRef } from 'vue';
import { expectType } from '#test-utils';

type Target = string | Element | ShadowRoot | null | undefined;
expectType<Target, AlertDialog.Portal.Props['to']>(null);
expectType<Target, Autocomplete.Portal.Props['to']>(null);
expectType<Target, Combobox.Portal.Props['to']>(null);
expectType<Target, ContextMenu.Portal.Props['to']>(null);
expectType<Target, DatePicker.Portal.Props['to']>(null);
expectType<Target, DateRangePicker.Portal.Props['to']>(null);
expectType<Target, Dialog.Portal.Props['to']>(null);
expectType<Target, Drawer.Portal.Props['to']>(null);
expectType<Target, Menu.Portal.Props['to']>(null);
expectType<Target, NavigationMenu.Portal.Props['to']>(null);
expectType<Target, Popover.Portal.Props['to']>(null);
expectType<Target, PreviewCard.Portal.Props['to']>(null);
expectType<Target, Select.Portal.Props['to']>(null);
expectType<Target, TimePicker.Portal.Props['to']>(null);
expectType<Target, Toast.Portal.Props['to']>(null);
expectType<Target, Tooltip.Portal.Props['to']>(null);

export function useTypeTests(element: Element, shadow: ShadowRoot, ref: ShallowRef<Element | null>) {
  <Dialog.Portal to="#teleports" />;
  <Dialog.Portal to={element} />;
  <Dialog.Portal to={shadow} />;
  <Dialog.Portal to={null} disabled />;
  // @ts-expect-error Pass the element held by the ref.
  <Dialog.Portal to={ref} />;
  // @ts-expect-error The target must be a value.
  <Dialog.Portal to={() => element} />;
  // @ts-expect-error The target prop is to.
  <Dialog.Portal container={element} />;
}
