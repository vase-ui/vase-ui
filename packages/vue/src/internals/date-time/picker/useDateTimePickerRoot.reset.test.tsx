import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { createRenderer, flushMicrotasks, screen, wait } from '#test-utils';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import { NOOP } from '../../noop';
import { REASONS } from '../../reasons';
import { useFormReset } from '../../useFormReset';
import type { DateTimeFieldChangeEventDetails } from '../field/DateTimeFieldContext';
import type { TemporalValue } from '../temporal';
import { recordResetListeners } from './test-utils';
import { useDateTimePickerRoot } from './useDateTimePickerRoot';

type End = 'start' | 'end';
type Ends = readonly [TemporalValue | null, TemporalValue | null];
type Probe = InstanceType<typeof DateTimeFieldProbe>;

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

    const probes: Record<End, ShallowRef<Probe | null>> = {
      start: shallowRef(null),
      end: shallowRef(null),
    };
    let lastReset: Event | undefined;
    for (const probe of Object.values(probes)) {
      useFormReset(
        computed(() => probe.value?.context.hiddenInputElement.value ?? null),
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
        <DateTimeFieldProbe
          ref={probes[end]}
          locale="en-US"
          modelValue={(picker.value.value ?? EMPTY)[index] ?? null}
          onValueChange={(
            value: TemporalValue | null,
            details: DateTimeFieldChangeEventDetails,
          ) => {
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

  // The first part that hears of the reset puts the picker back to its default value. The field
  // root of the other end then gets its value before its own part hears of the reset, so the
  // picker must tell each root about the reset, and not the part of that root.
  describe.each([{ order: 'the roots first' }, { order: 'the parts first' }])(
    'VUE-21: a native reset of a picker with two fields, with $order',
    ({ order }) => {
      const validate = vi.fn((value: unknown) => (value === null ? 'Choose a date' : 'Wrong date'));

      async function renderPicker() {
        validate.mockClear();
        const resets = recordResetListeners(document);
        const { container } = await render(
          <Form data-testid="form">
            <Field.Root data-testid="root" name="range" validate={validate} validationMode="change">
              <PickerOfTwoFields />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        return { container, resets };
      }

      async function fill(input: HTMLInputElement, text: string) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushMicrotasks();
      }

      async function resetForm(resets: ReturnType<typeof recordResetListeners>) {
        if (order === 'the parts first') {
          // The listener of the root and the listener of the part, for each of the two fields.
          resets.reverse(4);
        }
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
        const { container, resets } = await renderPicker();
        const [start, end] = hiddenInputsOf(container);
        await fill(start!, '2026-11-14');
        await fill(end!, '2026-11-20');
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
        validate.mockClear();

        await resetForm(resets);

        expect(hiddenInputsOf(container).map((input) => input.value)).toEqual(['', '']);
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        await fill(end!, '2026-11-21');

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
      });

      it('leaves no mark on the field whose value the reset keeps', async () => {
        const { container, resets } = await renderPicker();
        const [start, end] = hiddenInputsOf(container);
        await fill(start!, '2026-11-14');
        validate.mockClear();

        await resetForm(resets);

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
