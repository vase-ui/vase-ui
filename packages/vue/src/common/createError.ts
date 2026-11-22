/**
 * The text of each error of the package, by its code. `{0}`, `{1}` and so on take the values of
 * the error, in order. A production build has no texts: https://vase-ui.com/errors shows them.
 */
export const errorMessages = {
  1: 'Vase UI: <Accordion.Item> must be inside <Accordion.Root>. Without a root the item has no value to read. Put the item inside <Accordion.Root>.',
  2: 'Vase UI: A part of Accordion must be inside <Accordion.Item>. Without an item the part has no open state to read. Put the part inside <Accordion.Item>.',
  3: 'Vase UI Avatar: <Avatar.{0}> must be inside <Avatar.Root>.',
  4: 'Vase UI: A month cell or a year cell of Calendar must be inside <Calendar.MonthGrid> or <Calendar.YearGrid>. Without the grid the cell has no row, so the keys cannot move the focus by a row. Put the cell inside its grid.',
  5: 'Vase UI: The `modifiers` prop of <{0}> has the key `{1}`. A day uses the attribute `data-{2}` for a meaning of its own, so the attribute would have two meanings. Rename the modifier.',
  6: 'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
  7: 'Vase UI: <Calendar.DayButton> must be inside <Calendar.Day>. Without a day the button has no date to select. Put the button inside <Calendar.Day>.',
  8: 'Vase UI: A part of Calendar must be inside <Calendar.Root> or <RangeCalendar.Root>. Without a root the part has no days and no selection to show. Put the part inside a root.',
  9: 'Vase UI: <{0}> has `broadcastCalendar` and shows the calendar `{1}`. The broadcast calendar is made of Gregorian months, so no other calendar can show it. Remove `broadcastCalendar`, or set `calendar="gregory"`.',
  10: 'Vase UI: A part of Collapsible must be inside <Collapsible.Root>. Without a root the part has no open state to read. Put the part inside <Collapsible.Root>.',
  11: 'Vase UI: <Combobox.ChipRemove> must be inside <Combobox.Chip>. Without a chip the button has no value to remove. Put the button inside <Combobox.Chip>.',
  12: 'Vase UI: <Autocomplete.{0}> must be inside <Autocomplete.Root>. Without a root the part has no combobox. Put the part inside its root.',
  13: 'Vase UI: <Combobox.{0}> or <Autocomplete.{0}> must be inside <Combobox.Root> or <Autocomplete.Root>. Without a root the part has no combobox. Put the part inside its root.',
  14: 'Vase UI: <{0}.{1}> must be inside <{0}.Portal>. Put the part inside <{0}.Portal>.',
  15: 'Vase UI: <{0}.{1}> must be inside <{0}.Positioner>. Put the part inside <{0}.Positioner>.',
  16: 'Vase UI: <Combobox.{0}> must be inside <Combobox.Chips>. Without the chips the part has no value. Put the part inside <Combobox.Chips>.',
  17: 'Vase UI: useFilteredItems() must be called in a component inside a root of Combobox or Autocomplete. Without a root there are no items. Call it in a component inside the root.',
  18: 'Vase UI: A part of a date or time field must be inside its root. Without a root the part has no value to show. Put the part inside <DateField.Root> or <TimeField.Root>.',
  19: 'Vase UI: <{0}> needs the global `Temporal`, and this JavaScript engine does not have it. The part cannot make or compare a date without it. Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
  20: 'Vase UI: <ContextMenu.Trigger> must be inside <ContextMenu.Root>. Without a root the trigger has no menu to open. Put the trigger inside <ContextMenu.Root>.',
  21: 'Vase UI: <DatePicker.TimeField> needs a picker whose value has a time. Without a time the field has no segments to show. Set `granularity` to `hour`, `minute` or `second`, or give the picker a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`.',
  22: 'Vase UI: <DatePicker.{0}> must be inside <DatePicker.Root>. Without a root the part has no value and no popup. Put the part inside <DatePicker.Root>.',
  23: 'Vase UI: <DateRangePicker.{0}> must be inside <DateRangePicker.Root>. Without a root the part has no range and no popup. Put the part inside <DateRangePicker.Root>.',
  24: 'Vase UI: <Dialog.{0}> must be inside <Dialog.Root>, <AlertDialog.Root> or <Drawer.Root>. Without a root the part has no dialog. Put the part inside one of these roots.',
  25: 'Vase UI: <{0}.Trigger> must be inside <{0}.Root>, or it must have a `handle`. Without a root the trigger has no dialog to open. Put the trigger inside <{0}.Root>, or pass a `handle`.',
  26: 'Vase UI: <{0}.{1}> must be inside <{0}.Portal>. Without the portal the part is not above the page. Put the part inside <{0}.Portal>.',
  27: 'Vase UI: <Drawer.Popup> must be inside <Drawer.Viewport>. The viewport holds the swipe of the drawer. Put the popup inside <Drawer.Viewport>.',
  28: 'Vase UI: <Drawer.{0}> must be inside <Drawer.Root>. Without a root the part has no drawer. Put the part inside <Drawer.Root>.',
  29: 'Vase UI Field: <Field.{0}> must be inside <Field.Root>.',
  30: 'Vase UI: <Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>. Without a submenu root the trigger has no submenu to open. Put the trigger inside <Menu.SubmenuRoot>.',
  31: 'Vase UI: <Menu.{0}> must be in a menu inside <Menu.FilterProvider>. Without a provider the menu has no query. Put the root of the menu inside <Menu.FilterProvider>.',
  32: 'Vase UI: <Menu.GroupLabel> must be inside <Menu.Group> or <Menu.RadioGroup>. Without a group the label names nothing. Put the label inside a group.',
  33: 'Vase UI: <Menu.RadioItem> must be inside <Menu.RadioGroup>. Without a group the item has no value to check. Put the item inside <Menu.RadioGroup>.',
  34: 'Vase UI: <Menu.{0}> must be inside <Menu.Root>, <Menu.SubmenuRoot> or <ContextMenu.Root>. Without a root the part has no menu. Put the part inside a root of a menu.',
  35: 'Vase UI: <Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`. Without a root the trigger has no menu to open. Put the trigger inside <Menu.Root>, or pass a `handle`.',
  36: 'Vase UI: <Menu.{0}> must be inside <Menu.Portal>. Put the part inside <Menu.Portal>.',
  37: 'Vase UI: <Menu.{0}> must be inside <Menu.Positioner>. Put the part inside <Menu.Positioner>.',
  38: 'Vase UI Meter: <Meter.{0}> must be inside <Meter.Root>.',
  39: 'Vase UI: <NavigationMenu.{0}> must be inside <NavigationMenu.{1}>. Put the part inside <NavigationMenu.{1}>.',
  40: 'Vase UI NumberField: <NumberField.{0}> must be inside <NumberField.Root>.',
  41: 'Vase UI: A part of OTP Field must be inside <OTPField.Root>. Without a root the part has no value to show. Put the part inside <OTPField.Root>.',
  42: 'Vase UI: <Popover.{0}> must be inside <Popover.Root>. Without a root the part has no popover. Put the part inside <Popover.Root>.',
  43: 'Vase UI: <Popover.Trigger> must be inside <Popover.Root>, or it must have a `handle`. Without a root the trigger has no popover to open. Put the trigger inside <Popover.Root>, or pass a `handle`.',
  44: 'Vase UI: <Popover.{0}> must be inside <Popover.Positioner>. Put the part inside <Popover.Positioner>.',
  45: 'Vase UI: <Popover.{0}> must be inside <Popover.Portal>. Put the part inside <Popover.Portal>.',
  46: 'Vase UI: The handle has no trigger with the id "{0}". Give this id to a trigger of the root, or open the popup with the id of one of its triggers.',
  47: 'Vase UI: <PreviewCard.{0}> must be inside <PreviewCard.Root>. Without a root the part has no preview card. Put the part inside <PreviewCard.Root>.',
  48: 'Vase UI: <PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`. Without a root the trigger has no preview card to open. Put the trigger inside <PreviewCard.Root>, or pass a `handle`.',
  49: 'Vase UI: <PreviewCard.{0}> must be inside <PreviewCard.Positioner>. Put the part inside <PreviewCard.Positioner>.',
  50: 'Vase UI: <PreviewCard.{0}> must be inside <PreviewCard.Portal>. Put the part inside <PreviewCard.Portal>.',
  51: 'Vase UI Progress: <Progress.{0}> must be inside <Progress.Root>.',
  52: 'Vase UI: <Radio> must be inside <RadioGroup>. A radio with no group cannot hold a choice. Put <Radio> inside <RadioGroup>.',
  53: 'Vase UI Resizable: <Resizable.{0}> must be inside <Resizable.Root>.',
  54: 'Vase UI ScrollArea: <ScrollArea.{0}> must be inside <ScrollArea.Root>.',
  55: 'Vase UI ScrollArea: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>.',
  56: 'Vase UI ScrollArea: <ScrollArea.Content> must be inside <ScrollArea.Viewport>.',
  57: 'Vase UI: <Select.GroupLabel> must be inside <Select.Group>. Without a group the label names nothing. Put the label inside <Select.Group>.',
  58: 'Vase UI: <Select.ItemText> must be inside <Select.Item>. Without an item the text belongs to no option. Put the text inside <Select.Item>.',
  59: 'Vase UI: <Select.{0}> must be inside <Select.Root>. Without a root the part has no value and no popup. Put the part inside <Select.Root>.',
  60: 'Vase UI: <Select.{0}> must be inside <Select.Positioner>. Put the part inside <Select.Positioner>.',
  61: 'Vase UI: <Select.{0}> must be inside <Select.Portal>. Put the part inside <Select.Portal>.',
  62: 'Vase UI Slider: <Slider.{0}> must be inside <Slider.Root>.',
  63: 'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
  64: 'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
  65: 'Vase UI: A part of TimeClock must be inside <TimeClock.Root>. Without a root the part has no time to show or to change. Put the part inside <TimeClock.Root>.',
  66: 'Vase UI: <TimePicker.{0}> must be inside <TimePicker.{1}>. Without it the item has no time to give. Put the item inside <TimePicker.{1}>.',
  67: 'Vase UI: <TimePicker.{0}> must be inside <TimePicker.Root>. Without a root the part has no value and no popup. Put the part inside <TimePicker.Root>.',
  68: 'Vase UI: {0} must be inside <Toast.Provider>. Without a provider the part has no toasts. Put the part inside <Toast.Provider>.',
  69: 'Vase UI: <Toast.{0}> must be inside <Toast.Root>. Without a root the part has no toast. Put the part inside <Toast.Root>.',
  70: 'Vase UI: <Toast.{0}> must be inside <Toast.Positioner>. Put the part inside <Toast.Positioner>.',
  71: 'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
  72: 'Vase UI: <Tooltip.{0}> must be inside <Tooltip.Root>. Without a root the part has no tooltip. Put the part inside <Tooltip.Root>.',
  73: 'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`. Without a root the trigger has no tooltip to open. Put the trigger inside <Tooltip.Root>, or pass a `handle`.',
  74: 'Vase UI: <Tooltip.{0}> must be inside <Tooltip.Positioner>. Put the part inside <Tooltip.Positioner>.',
  75: 'Vase UI: <Tooltip.{0}> must be inside <Tooltip.Portal>. Put the part inside <Tooltip.Portal>.',
} as const;

type Code = keyof typeof errorMessages;

/** One value for each placeholder `{0}`, `{1}` and so on of the text. */
type Values<
  Text extends string,
  Found extends string[] = [],
> = Text extends `${string}{${Found['length']}}${string}`
  ? Values<Text, [...Found, string]>
  : Found;

/**
 * The error of a code. A development build gives the text with the values. A production build
 * gives the code, the values and the address of the text.
 */
export function createError<C extends Code>(
  code: C,
  ...values: Values<(typeof errorMessages)[C]>
): Error {
  // eslint-disable-next-line no-restricted-syntax -- Each error of the package comes from here.
  return new Error(
    process.env.NODE_ENV !== 'production'
      ? values.reduce<string>(
          (text, value, index) => text.replaceAll(`{${index}}`, value),
          errorMessages[code],
        )
      : `Vase UI error #${code} ${JSON.stringify(values)}: https://vase-ui.com/errors#${code}`,
  );
}
