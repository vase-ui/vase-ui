import type { AlertDialog } from '@vase-ui/vue/alert-dialog';
import type { Autocomplete } from '@vase-ui/vue/autocomplete';
import type { Combobox } from '@vase-ui/vue/combobox';
import type { ContextMenu } from '@vase-ui/vue/context-menu';
import type { DatePicker } from '@vase-ui/vue/date-picker';
import type { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Dialog } from '@vase-ui/vue/dialog';
import type { Menu } from '@vase-ui/vue/menu';
import type { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import type { Popover } from '@vase-ui/vue/popover';
import type { PreviewCard } from '@vase-ui/vue/preview-card';
import type { Select } from '@vase-ui/vue/select';
import type { TimePicker } from '@vase-ui/vue/time-picker';
import type { Toast } from '@vase-ui/vue/toast';
import type { Tooltip } from '@vase-ui/vue/tooltip';
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
expectType<Target, Menu.Portal.Props['to']>(null);
expectType<Target, NavigationMenu.Portal.Props['to']>(null);
expectType<Target, Popover.Portal.Props['to']>(null);
expectType<Target, PreviewCard.Portal.Props['to']>(null);
expectType<Target, Select.Portal.Props['to']>(null);
expectType<Target, TimePicker.Portal.Props['to']>(null);
expectType<Target, Toast.Portal.Props['to']>(null);
expectType<Target, Tooltip.Portal.Props['to']>(null);

export function useTypeTests(
  element: Element,
  shadow: ShadowRoot,
  ref: ShallowRef<Element | null>,
) {
  <Dialog.Portal to="#teleports" />;
  <Dialog.Portal to={element} />;
  <Dialog.Portal to={shadow} />;
  <Dialog.Portal to={null} disabled />;
  // @ts-expect-error Pass the element held by the ref.
  <Dialog.Portal to={ref} />;
  // @ts-expect-error The target must be a value.
  <Dialog.Portal to={() => element} />;
  // @ts-expect-error Pass the element exposed by a component.
  <Dialog.Portal to={{ element }} />;
  // @ts-expect-error The target prop is to.
  <Dialog.Portal container={element} />;
}
