import { h, mergeProps, Transition } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { withProps } from './withProps';

export const Root = Combobox.Root;

export const Input = withProps(Combobox.Input, {
  class:
    'h-full w-full border-0 bg-white pl-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 outline-none placeholder:text-neutral-500 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
});

export const InputGroup = withProps(Combobox.InputGroup, {
  class:
    'relative h-8 w-64 border border-neutral-950 bg-white focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:focus-within:outline-white dark:border-white dark:bg-neutral-950 [&>input]:pr-[2.5rem] has-[.combobox-clear]:[&>input]:pr-[calc(0.5rem+2rem*2)]',
});

const ClearWrapper: FunctionalComponent = (_, { attrs, slots }) =>
  h(
    Combobox.Clear,
    mergeProps(
      {
        'aria-label': 'Clear selection',
        class:
          'combobox-clear flex h-full w-6 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white',
      },
      attrs,
    ),
    { ...slots, default: () => h(XIcon) },
  );
ClearWrapper.inheritAttrs = false;
export const Clear = ClearWrapper as unknown as typeof Combobox.Clear;

export const Trigger = withProps(Combobox.Trigger, {
  class:
    'flex h-full w-6 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white',
});

export const Portal = Combobox.Portal;

export const Positioner = withProps(Combobox.Positioner, { class: 'outline-none', sideOffset: 4 });

// The enter-from and leave-to class of the `<Transition>` around the popup.
const POPUP_HIDDEN = 'scale-95 opacity-0';

const PopupWrapper: FunctionalComponent = (_, { attrs, slots }) =>
  h(Transition, { enterFromClass: POPUP_HIDDEN, leaveToClass: POPUP_HIDDEN }, () =>
    h(
      Combobox.Popup,
      mergeProps(
        {
          class:
            'w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0_rgb(0_0_0/12%)] transition-[scale,opacity] duration-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none',
        },
        attrs,
      ),
      slots,
    ),
  );
PopupWrapper.inheritAttrs = false;
export const Popup = PopupWrapper as unknown as typeof Combobox.Popup;

const EmptyWrapper: FunctionalComponent = (_, { attrs, slots }) => {
  const { class: className, ...props } = attrs;
  return h(Combobox.Empty, props, {
    ...slots,
    default: () =>
      slots.default
        ? h(
            'div',
            {
              class: [
                'py-4 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400',
                className,
              ],
            },
            slots.default(),
          )
        : null,
  });
};
EmptyWrapper.inheritAttrs = false;
export const Empty = EmptyWrapper as unknown as typeof Combobox.Empty;

export const List = withProps(Combobox.List, {
  class:
    'outline-0 overflow-y-auto scroll-py-[0.25rem] py-1 overscroll-contain max-h-[min(22.5rem,var(--available-height))] data-empty:p-0',
});

export const Item = withProps(Combobox.Item, {
  class:
    'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 p-2 text-sm leading-4 outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white',
});

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

export const CaretDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', mergeProps({ ...ICON_PROPS, fill: 'currentColor' }, attrs), [
    h('path', { d: 'M12 6H4l4 4.5z' }),
  ]);
CaretDownIcon.inheritAttrs = false;

const XIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );
