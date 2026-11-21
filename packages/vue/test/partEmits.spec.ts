import type { IfEquals } from '#test-utils';
import type { Accordion, AccordionItemEmits, AccordionRootEmits } from '@vase-ui/vue/accordion';
import type { AlertDialog, AlertDialogRootEmits } from '@vase-ui/vue/alert-dialog';
import type { Autocomplete, AutocompleteRootEmits } from '@vase-ui/vue/autocomplete';
import type { Avatar, AvatarImageEmits } from '@vase-ui/vue/avatar';
import type { Calendar, CalendarRootEmits } from '@vase-ui/vue/calendar';
import type { Checkbox, CheckboxEmits } from '@vase-ui/vue/checkbox';
import type { CheckboxGroup, CheckboxGroupEmits } from '@vase-ui/vue/checkbox-group';
import type { Collapsible, CollapsibleRootEmits } from '@vase-ui/vue/collapsible';
import type { Combobox, ComboboxRootEmits } from '@vase-ui/vue/combobox';
import type { ContextMenu, ContextMenuRootEmits } from '@vase-ui/vue/context-menu';
import type { DateField, DateFieldRootEmits } from '@vase-ui/vue/date-field';
import type { DatePicker, DatePickerRootEmits } from '@vase-ui/vue/date-picker';
import type { DateRangePicker, DateRangePickerRootEmits } from '@vase-ui/vue/date-range-picker';
import type { Dialog, DialogRootEmits } from '@vase-ui/vue/dialog';
import type { Drawer, DrawerRootEmits } from '@vase-ui/vue/drawer';
import type { Field, FieldRootEmits } from '@vase-ui/vue/field';
import type { Form, FormEmits } from '@vase-ui/vue/form';
import type { Input, InputEmits } from '@vase-ui/vue/input';
import type {
  Menu,
  MenuCheckboxItemEmits,
  MenuFilterProviderEmits,
  MenuRadioGroupEmits,
  MenuRootEmits,
  MenuSubmenuRootEmits,
} from '@vase-ui/vue/menu';
import type { NavigationMenu, NavigationMenuRootEmits } from '@vase-ui/vue/navigation-menu';
import type { NumberField, NumberFieldRootEmits } from '@vase-ui/vue/number-field';
import type { OTPField, OTPFieldRootEmits } from '@vase-ui/vue/otp-field';
import type { Popover, PopoverRootEmits } from '@vase-ui/vue/popover';
import type { PreviewCard, PreviewCardRootEmits } from '@vase-ui/vue/preview-card';
import type { RadioGroup, RadioGroupEmits } from '@vase-ui/vue/radio-group';
import type { RangeCalendar, RangeCalendarRootEmits } from '@vase-ui/vue/range-calendar';
import type { Resizable, ResizablePanelEmits, ResizableRootEmits } from '@vase-ui/vue/resizable';
import type { Select, SelectRootEmits } from '@vase-ui/vue/select';
import type { Slider, SliderRootEmits } from '@vase-ui/vue/slider';
import type { Switch, SwitchEmits } from '@vase-ui/vue/switch';
import type { Tabs, TabsRootEmits } from '@vase-ui/vue/tabs';
import type { TimeClock, TimeClockRootEmits } from '@vase-ui/vue/time-clock';
import type { TimeField, TimeFieldRootEmits } from '@vase-ui/vue/time-field';
import type {
  TimePicker,
  TimePickerClockEmits,
  TimePickerRootEmits,
} from '@vase-ui/vue/time-picker';
import type { Toggle, ToggleEmits } from '@vase-ui/vue/toggle';
import type { ToggleGroup, ToggleGroupEmits } from '@vase-ui/vue/toggle-group';
import type { Toolbar, ToolbarInputEmits } from '@vase-ui/vue/toolbar';
import type { Tooltip, TooltipRootEmits } from '@vase-ui/vue/tooltip';

/** The listener props that `defineEmits<Emits>()` gives a component. */
type ListenerProps<Emits> = {
  [Name in keyof Emits & string as `on${Capitalize<Name>}`]?: Emits[Name] extends unknown[]
    ? (...args: Emits[Name]) => any
    : never;
};

type PropsOf<Component> = Component extends new (...args: any) => { $props: infer Props }
  ? Props
  : Component extends (props: infer Props, ...args: any) => any
    ? Props
    : never;

/** The listener props of the part, with the names that `Emits` gives. A missing one is `never`. */
type PartListenerProps<Component, Emits> = {
  [Key in keyof ListenerProps<Emits>]: Key extends keyof PropsOf<Component>
    ? PropsOf<Component>[Key]
    : never;
};

/**
 * Makes a type error unless the namespace type and the flat type are one type, and the listener
 * props that the type gives a wrapper are the listener props of the part.
 */
function emitsOf<Component, NamespaceEmits, FlatEmits>(
  ..._mismatch: IfEquals<NamespaceEmits, FlatEmits> extends never
    ? [namespaceIsNotFlat: never]
    : [ListenerProps<FlatEmits>] extends [PartListenerProps<Component, FlatEmits>]
      ? [PartListenerProps<Component, FlatEmits>] extends [ListenerProps<FlatEmits>]
        ? []
        : [listenersDiffer: never]
      : [listenersDiffer: never]
): void {}

emitsOf<typeof Accordion.Root<string>, Accordion.Root.Emits<string>, AccordionRootEmits<string>>();
emitsOf<typeof Accordion.Item, Accordion.Item.Emits, AccordionItemEmits>();
emitsOf<typeof AlertDialog.Root<number>, AlertDialog.Root.Emits, AlertDialogRootEmits>();
emitsOf<
  typeof Autocomplete.Root<string>,
  Autocomplete.Root.Emits<string>,
  AutocompleteRootEmits<string>
>();
emitsOf<typeof Avatar.Image, Avatar.Image.Emits, AvatarImageEmits>();
emitsOf<
  typeof Calendar.Root<Temporal.PlainDate, true>,
  Calendar.Root.Emits<Temporal.PlainDate, true>,
  CalendarRootEmits<Temporal.PlainDate, true>
>();
emitsOf<typeof Checkbox, Checkbox.Emits, CheckboxEmits>();
emitsOf<typeof CheckboxGroup, CheckboxGroup.Emits, CheckboxGroupEmits>();
emitsOf<typeof Collapsible.Root, Collapsible.Root.Emits, CollapsibleRootEmits>();
emitsOf<
  typeof Combobox.Root<string, true, string>,
  Combobox.Root.Emits<string, true>,
  ComboboxRootEmits<string, true>
>();
emitsOf<typeof ContextMenu.Root, ContextMenu.Root.Emits, ContextMenuRootEmits>();
emitsOf<
  typeof DateField.Root<Temporal.PlainDate>,
  DateField.Root.Emits<Temporal.PlainDate>,
  DateFieldRootEmits<Temporal.PlainDate>
>();
emitsOf<
  typeof DatePicker.Root<Temporal.PlainDate>,
  DatePicker.Root.Emits<Temporal.PlainDate>,
  DatePickerRootEmits<Temporal.PlainDate>
>();
emitsOf<
  typeof DateRangePicker.Root<Temporal.PlainDate>,
  DateRangePicker.Root.Emits<Temporal.PlainDate>,
  DateRangePickerRootEmits<Temporal.PlainDate>
>();
emitsOf<typeof Dialog.Root<number>, Dialog.Root.Emits, DialogRootEmits>();
emitsOf<typeof Drawer.Root<number>, Drawer.Root.Emits, DrawerRootEmits>();
emitsOf<typeof Field.Root, Field.Root.Emits, FieldRootEmits>();
emitsOf<typeof Form<{ name: string }>, Form.Emits<{ name: string }>, FormEmits<{ name: string }>>();
emitsOf<typeof Input, Input.Emits, InputEmits>();
emitsOf<typeof Menu.Root<number>, Menu.Root.Emits, MenuRootEmits>();
emitsOf<typeof Menu.CheckboxItem, Menu.CheckboxItem.Emits, MenuCheckboxItemEmits>();
emitsOf<
  typeof Menu.RadioGroup<string>,
  Menu.RadioGroup.Emits<string>,
  MenuRadioGroupEmits<string>
>();
emitsOf<typeof Menu.SubmenuRoot, Menu.SubmenuRoot.Emits, MenuSubmenuRootEmits>();
emitsOf<typeof Menu.FilterProvider, Menu.FilterProvider.Emits, MenuFilterProviderEmits>();
emitsOf<
  typeof NavigationMenu.Root<string>,
  NavigationMenu.Root.Emits<string>,
  NavigationMenuRootEmits<string>
>();
emitsOf<typeof NumberField.Root, NumberField.Root.Emits, NumberFieldRootEmits>();
emitsOf<typeof OTPField.Root, OTPField.Root.Emits, OTPFieldRootEmits>();
emitsOf<typeof Popover.Root<number>, Popover.Root.Emits, PopoverRootEmits>();
emitsOf<typeof PreviewCard.Root<number>, PreviewCard.Root.Emits, PreviewCardRootEmits>();
emitsOf<typeof RadioGroup<string>, RadioGroup.Emits<string>, RadioGroupEmits<string>>();
emitsOf<
  typeof RangeCalendar.Root<Temporal.ZonedDateTime>,
  RangeCalendar.Root.Emits<Temporal.ZonedDateTime>,
  RangeCalendarRootEmits<Temporal.ZonedDateTime>
>();
emitsOf<typeof Resizable.Root, Resizable.Root.Emits, ResizableRootEmits>();
emitsOf<typeof Resizable.Panel, Resizable.Panel.Emits, ResizablePanelEmits>();
emitsOf<
  typeof Select.Root<string, true>,
  Select.Root.Emits<string, true>,
  SelectRootEmits<string, true>
>();
emitsOf<
  typeof Slider.Root<readonly number[]>,
  Slider.Root.Emits<readonly number[]>,
  SliderRootEmits<readonly number[]>
>();
emitsOf<typeof Switch, Switch.Emits, SwitchEmits>();
emitsOf<typeof Tabs.Root<string>, Tabs.Root.Emits<string>, TabsRootEmits<string>>();
emitsOf<
  typeof TimeClock.Root<Temporal.ZonedDateTime>,
  TimeClock.Root.Emits<Temporal.ZonedDateTime>,
  TimeClockRootEmits<Temporal.ZonedDateTime>
>();
emitsOf<
  typeof TimeField.Root<Temporal.ZonedDateTime>,
  TimeField.Root.Emits<Temporal.ZonedDateTime>,
  TimeFieldRootEmits<Temporal.ZonedDateTime>
>();
emitsOf<
  typeof TimePicker.Root<Temporal.ZonedDateTime>,
  TimePicker.Root.Emits<Temporal.ZonedDateTime>,
  TimePickerRootEmits<Temporal.ZonedDateTime>
>();
emitsOf<typeof TimePicker.Clock, TimePicker.Clock.Emits, TimePickerClockEmits>();
emitsOf<typeof Toggle, Toggle.Emits, ToggleEmits>();
emitsOf<
  typeof ToggleGroup<'bold' | 'italic'>,
  ToggleGroup.Emits<'bold' | 'italic'>,
  ToggleGroupEmits<'bold' | 'italic'>
>();
emitsOf<typeof Toolbar.Input, Toolbar.Input.Emits, ToolbarInputEmits>();
emitsOf<typeof Tooltip.Root<number>, Tooltip.Root.Emits, TooltipRootEmits>();

// The check refuses listener props that differ from the part.
type MultipleSelect = typeof Select.Root<string, true>;
// @ts-expect-error `multiple` gives an array to the listeners of the part.
emitsOf<MultipleSelect, Select.Root.Emits<string>, SelectRootEmits<string>>();
// @ts-expect-error The emits of a dialog are not the emits of a checkbox.
emitsOf<typeof Checkbox, Dialog.Root.Emits, DialogRootEmits>();
// @ts-expect-error The namespace type and the flat type are one type.
emitsOf<MultipleSelect, Select.Root.Emits<string, true>, SelectRootEmits<string>>();
