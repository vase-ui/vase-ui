import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { createRenderer, flushMicrotasks, screen, wait } from '#test-utils';
import type { DateTimeFieldChangeEventDetails } from '../../../common/date-time-field/field';
import { DateField } from '../../../date-field';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import { NOOP } from '../../noop';
import { REASONS } from '../../reasons';
import { useFormReset } from '../../useFormReset';
import type { DateValue } from '../temporal';
import { useDateTimePickerRoot } from './useDateTimePickerRoot';

type End = 'start' | 'end';
type Ends = readonly [DateValue | null, DateValue | null];
interface FieldRoot {
  inputElement: HTMLInputElement | null;
}

const EMPTY: Ends = [null, null];

// A picker with a start and an end, as a range picker is. Each end shows in a field root, and the
// part of each field listens for the reset of the form. The two parts hear of one reset in two
// timeouts, and the picker takes the reset one time.
const PickerOfTwoFields = defineComponent({
  setup() {
    const picker = useDateTimePickerRoot<Ends, DateTimeFieldChangeEventDetails>({
      part: 'PickerOfTwoFields',
      disabled: false,
      value: () => undefined,
      defaultValue: () => EMPTY,
      fallback: () => EMPTY,
      closeOnSelect: () => undefined,
      hasTime: () => false,
      valueChange: NOOP,
      updateValue: NOOP,
    });

    const roots: Record<End, ShallowRef<FieldRoot | null>> = {
      start: shallowRef(null),
      end: shallowRef(null),
    };
    let lastReset: Event | undefined;
    for (const root of Object.values(roots)) {
      useFormReset(
        computed(() => root.value?.inputElement ?? null),
        (event) => {
          if (event !== lastReset) {
            lastReset = event;
            picker.reset(createChangeEventDetails(REASONS.none, event));
          }
        },
      );
    }

    function field(end: End) {
      const index = end === 'start' ? 0 : 1;
      return (
        <DateField.Root
          ref={roots[end]}
          modelValue={(picker.value.value ?? EMPTY)[index] ?? null}
          onValueChange={(value: DateValue | null, details: DateTimeFieldChangeEventDetails) => {
            const [start, last] = picker.value.value ?? EMPTY;
            picker.commit(end === 'start' ? [value, last] : [start, value], details);
          }}
        />
      );
    }

    return () => [field('start'), field('end')];
  },
});

const hiddenInputsOf = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'));

describe('useDateTimePickerRoot', () => {
  const { render } = createRenderer();

  // Each root listens on the form and hears of the reset before the parts, which listen on the
  // document. The root tells its field the reset, so the value that the picker gives with the next
  // render starts no validation.
  describe.each([{ order: 'the roots first' }])(
    'VUE-21: a native reset of a picker with two fields, with $order',
    () => {
      const validate = vi.fn((value: unknown) => (value === null ? 'Choose a date' : 'Wrong date'));

      async function renderPicker() {
        validate.mockClear();
        const { container } = await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="range" validate={validate} validationMode="change">
              <PickerOfTwoFields />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        return { container };
      }

      async function fill(input: HTMLInputElement, text: string) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushMicrotasks();
      }

      async function resetForm() {
        screen.getByTestId<HTMLFormElement>('form').reset();
        // Each timeout of the reset starts before this one, and a flush of Vue comes after each.
        await wait(0);
        await flushMicrotasks();
      }

      function expectNeutralField() {
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-valid');
      }

      it('starts no validation for the value of each end, and validates the next entry', async () => {
        const { container } = await renderPicker();
        const [start, end] = hiddenInputsOf(container);
        await fill(start!, '2026-11-14');
        await fill(end!, '2026-11-20');
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
        validate.mockClear();

        await resetForm();

        expect(hiddenInputsOf(container).map((input) => input.value)).toEqual(['', '']);
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        await fill(end!, '2026-11-21');

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
      });

      it('leaves no mark on the field whose value the reset keeps', async () => {
        const { container } = await renderPicker();
        const [start, end] = hiddenInputsOf(container);
        await fill(start!, '2026-11-14');
        validate.mockClear();

        await resetForm();

        expect(hiddenInputsOf(container).map((input) => input.value)).toEqual(['', '']);
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        await fill(end!, '2026-11-21');

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
      });
    },
  );
});
