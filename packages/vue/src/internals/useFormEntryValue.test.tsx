import { describe, expect, it, onTestFinished } from 'vitest';
import { Teleport, defineComponent, h, shallowRef } from 'vue';
import { createHeldBranch, createRenderer, screen } from '#test-utils';
import { useFormEntryValue } from './useFormEntryValue';

const VALUE = 'Main Street 1\nFlat 2';
const TEXT = 'Main Street 1Flat 2';

// An input that has `value`, as Vue writes it, and that calls the composable.
const EntryInput = defineComponent({
  props: {
    value: { type: String, required: true },
    disabled: Boolean,
    form: { type: String, default: undefined },
  },
  setup(props) {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormEntryValue(input, () => props.value);
    return () =>
      h('input', {
        ref: (element) => {
          input.value = element as HTMLInputElement | null;
        },
        name: 'address',
        value: props.value,
        disabled: props.disabled,
        form: props.form,
        'data-testid': 'part',
      });
  },
});

function getEntries(form: HTMLFormElement = screen.getByTestId('form')) {
  return Array.from(new FormData(form));
}

describe('useFormEntryValue', () => {
  const { render } = createRenderer();

  it.each([
    { name: 'a line feed', value: VALUE },
    { name: 'a carriage return', value: 'Main Street 1\rFlat 2' },
    { name: 'a carriage return and a line feed', value: 'Main Street 1\r\nFlat 2' },
  ])('gives the entry the value with $name, in its place', async ({ value }) => {
    await render(
      <form data-testid="form">
        <EntryInput value={value} />
        <input name="note" value="after" />
      </form>,
    );
    expect(screen.getByTestId<HTMLInputElement>('part').value).toBe(TEXT);

    expect(getEntries()).toEqual([
      ['address', value],
      ['note', 'after'],
    ]);
  });

  it('gives the value to a formdata listener of the consumer on the form', async () => {
    await render(
      <form data-testid="form">
        <EntryInput value={VALUE} />
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>('form');
    let entries: FormDataEntryValue[] = [];
    form.addEventListener('formdata', (event) => {
      entries = event.formData.getAll('address');
    });

    expect(getEntries()).toEqual([['address', VALUE]]);
    expect(entries).toEqual([VALUE]);
  });

  it.each([
    {
      name: 'an earlier input with the same text',
      before: () => <input name="address" value={TEXT} />,
      expected: [
        ['address', TEXT],
        ['address', VALUE],
      ],
    },
    {
      name: 'an earlier disabled input',
      before: () => <input name="address" value={TEXT} disabled />,
      expected: [['address', VALUE]],
    },
    {
      name: 'an earlier part with the same value',
      before: () => <EntryInput value={VALUE} />,
      expected: [
        ['address', VALUE],
        ['address', VALUE],
      ],
    },
  ])('finds its entry after $name', async ({ before, expected }) => {
    await render(
      <form data-testid="form">
        {before()}
        <EntryInput value={VALUE} />
      </form>,
    );

    expect(getEntries()).toEqual(expected);
  });

  it.each([
    {
      name: 'an earlier hidden input with the value',
      before: () => <input type="hidden" name="address" value={'Main Street 1\r\nFlat 2'} />,
      expected: [
        ['address', 'Main Street 1\r\nFlat 2'],
        ['address', VALUE],
      ],
    },
    {
      name: 'an earlier unchecked checkbox',
      before: () => <input type="checkbox" name="address" value={VALUE} />,
      expected: [['address', VALUE]],
    },
    {
      name: 'an earlier select with the text',
      before: () => (
        <select name="address">
          <option value={TEXT}>Office</option>
        </select>
      ),
      expected: [
        ['address', TEXT],
        ['address', TEXT],
      ],
    },
  ])('changes only its own entry after $name', async ({ before, expected }) => {
    await render(
      <form data-testid="form">
        {before()}
        <EntryInput value={VALUE} />
      </form>,
    );

    expect(getEntries()).toEqual(expected);
  });

  it('changes no entry of a disabled input', async () => {
    await render(
      <form data-testid="form">
        <EntryInput value={VALUE} disabled />
        <input name="address" value={TEXT} />
      </form>,
    );

    expect(getEntries()).toEqual([['address', TEXT]]);
  });

  it('changes no entry of another form', async () => {
    await render(
      <div>
        <form data-testid="form">
          <input name="address" value={TEXT} />
        </form>
        <form id="other" data-testid="other" />
        <EntryInput value={VALUE} form="other" />
      </div>,
    );

    expect(getEntries()).toEqual([['address', TEXT]]);
    expect(getEntries(screen.getByTestId('other'))).toEqual([['address', VALUE]]);
  });

  it('keeps a text that is not the sanitized value', async () => {
    await render(
      <form data-testid="form">
        <EntryInput value={VALUE} />
      </form>,
    );
    screen.getByTestId<HTMLInputElement>('part').value = 'Box 1';

    expect(getEntries()).toEqual([['address', 'Box 1']]);
  });

  it('gives the entry the value in a shadow root', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    onTestFinished(() => host.remove());
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const target = document.createElement('div');
    shadowRoot.append(target);

    await render(
      <Teleport to={target}>
        <form>
          <EntryInput value={VALUE} />
        </form>
      </Teleport>,
    );

    expect(getEntries(shadowRoot.querySelector('form')!)).toEqual([['address', VALUE]]);
  });

  it('gives the entry the value after a mount in a held branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
      () => <EntryInput value={VALUE} />,
      { renderBranch: (part) => <form data-testid="form">{part}</form> },
    );
    await render(<HeldBranch />);

    await mountWhileHeld();
    await show();

    expect(getEntries()).toEqual([['address', VALUE]]);
  });
});
