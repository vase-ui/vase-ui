import { computed, inject, provide, shallowReactive, watch, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { DateValue } from '../common/date-time/temporal';
import { sameTemporal } from '../common/date-time/temporal';
import { byDocumentOrder } from '../common/element';
import type { PickerForPart } from '../common/picker/root';
import { fieldKey, type FieldControl, type FieldForControl } from '../field/control';
import type { DateRangePickerRootProps, DateRangePickerRootValue } from './types';

/** The start field or the end field. */
export type RangeEnd = 0 | 1;

/** What `DateRangePicker.Root` gives to its parts. The properties are reactive. */
export interface DateRangePickerForPart extends PickerForPart<DateRangePickerRootValue, DateValue> {
  readonly props: Readonly<DateRangePickerRootProps>;
  /** The calendar that the fields show, so that the grid shows it too. */
  readonly calendar: string;
  /** The range, `[null, null]` with no value. */
  readonly range: DateRangePickerRootValue;
  /** The first start field and the first end field in the document. */
  readonly ends: readonly [HTMLElement | undefined, HTMLElement | undefined];
  /** The `id` of the label of the `Field` around the picker. */
  readonly labelId: string | undefined;
  addEnd(end: RangeEnd, element: HTMLElement): () => void;
  /** The focus left a field. The `Field` gets a leave only when the focus left both fields. */
  onFocusout(event: FocusEvent): void;
}

export const dateRangePickerKey: InjectionKey<DateRangePickerForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'date range picker' : undefined,
);

/** The root of the part. A part with no root throws an error that names it. */
export function injectDateRangePicker(part: string): DateRangePickerForPart {
  const picker = inject(dateRangePickerKey, null);
  if (!picker) {
    throw createError(23, part);
  }
  return picker;
}

export const sameRange = (a: DateRangePickerRootValue | null, b: DateRangePickerRootValue | null) =>
  sameTemporal(a?.[0], b?.[0]) && sameTemporal(a?.[1], b?.[1]);

/**
 * The picker is the one control of a `Field` around it. Its two field roots give it their controls
 * through a field of the form of `useFieldGroup`, and it gives the `Field` one control of both.
 */
export function useRangeControl(
  field: FieldForControl | null,
  range: () => DateRangePickerRootValue,
  state: { disabled: () => boolean; readonly: () => boolean },
) {
  const ends = [shallowReactive<HTMLElement[]>([]), shallowReactive<HTMLElement[]>([])] as const;
  const firstEnds = computed(
    () =>
      ends.map((list) => [...list].sort(byDocumentOrder)[0]) as [
        HTMLElement | undefined,
        HTMLElement | undefined,
      ],
  );
  const controls = shallowReactive<FieldControl[]>([]);
  const ordered = computed(() =>
    [...controls].sort((a, b) => byDocumentOrder(a.element, b.element)),
  );

  if (field) {
    provide(fieldKey, {
      get disabled() {
        return field.disabled;
      },
      name: undefined,
      controlId: undefined,
      hasLabel: false,
      setGivenId() {},
      onIdChange() {},
      labelId: undefined,
      labelledBy: undefined,
      get describedBy() {
        return field.describedBy;
      },
      get state() {
        return field.state;
      },
      setControl(control) {
        controls.push(control);
        return () => controls.splice(controls.indexOf(control), 1);
      },
      setValue() {},
      onEdit() {},
      onLeave() {},
      onReset() {},
    });
    watch(range, (next) => field.setValue(next, next[0] !== null || next[1] !== null), {
      immediate: true,
    });
    watch(
      () => ordered.value[0],
      (first, _, onCleanup) => {
        if (!first) return;
        onCleanup(
          field.setControl({
            element: first.element,
            id: first.id,
            name: undefined,
            get disabled() {
              return state.disabled();
            },
            get readOnly() {
              return state.readonly();
            },
            get inputs() {
              return ordered.value.flatMap((control) => control.inputs);
            },
            get customError() {
              return ordered.value.find((control) => control.customError)?.customError;
            },
            get focusElement() {
              const failing = ordered.value.find((control) =>
                control.inputs.some((input) => !input.validity.valid),
              );
              return (failing ?? first).focusElement;
            },
            sameValue: (a, b) =>
              sameRange(a as DateRangePickerRootValue | null, b as DateRangePickerRootValue | null),
          }),
        );
      },
      { flush: 'post' },
    );
  }

  return {
    get ends() {
      return firstEnds.value;
    },
    get labelId() {
      return field?.labelId;
    },
    addEnd(end: RangeEnd, element: HTMLElement) {
      const list = ends[end];
      list.push(element);
      return () => list.splice(list.indexOf(element), 1);
    },
    onFocusout(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      if (!ends.some((list) => list.some((element) => element.contains(next)))) {
        field?.onLeave(event.target as Element);
      }
    },
  };
}
