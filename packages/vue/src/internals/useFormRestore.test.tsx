import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  flushMicrotasks,
  mockPageBeforeLoad,
  recordInputEvents,
  screen,
  within,
} from '#test-utils';
import FormRestoreRender from '../../test/FormRestoreRender.test.vue';
import type { FormRestoreFamily } from '../../test/FormRestoreRender.test.vue';
import { useFormRestore, useFormRestoreAsInput } from './useFormRestore';

function renderInput(input: { value: HTMLInputElement | null }) {
  return h('input', {
    value: 'handled',
    'data-testid': 'input',
    ref: (element) => {
      input.value = element as HTMLInputElement | null;
    },
  });
}

function createRestorable(onRestore: (event: PageTransitionEvent) => void) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormRestore(input, onRestore);
    return () => renderInput(input);
  });
}

function createRestorableInput(leaves: boolean) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormRestoreAsInput(input, () => 'handled', leaves);
    return () => renderInput(input);
  });
}

describe('useFormRestore', () => {
  const { render } = createRenderer();

  it('calls the callback with the event of a restore', async () => {
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    await render(<Restorable />);
    const event = new PageTransitionEvent('pageshow');

    window.dispatchEvent(event);

    expect(handleRestore.mock.calls).toEqual([[event]]);
  });

  it('does not call the callback for a page from the back/forward cache', async () => {
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    await render(<Restorable />);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(handleRestore).not.toHaveBeenCalled();
  });

  it('removes the pageshow listener while deactivated', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    onTestFinished(() => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
    const count = (spy: typeof addSpy | typeof removeSpy) =>
      spy.mock.calls.filter(([eventType]) => eventType === 'pageshow').length;
    const Restorable = createRestorable(() => {});
    const shown = shallowRef(true);
    await render(() => (
      <KeepAlive>{shown.value ? <Restorable key="restorable" /> : null}</KeepAlive>
    ));
    expect([count(addSpy), count(removeSpy)]).toEqual([1, 0]);

    shown.value = false;
    await flushMicrotasks();

    expect([count(addSpy), count(removeSpy)]).toEqual([1, 1]);

    shown.value = true;
    await flushMicrotasks();

    expect([count(addSpy), count(removeSpy)]).toEqual([2, 1]);
  });
});

describe('useFormRestoreAsInput', () => {
  const { render } = createRenderer();

  async function restore(leaves: boolean, restored: string) {
    const RestorableInput = createRestorableInput(leaves);
    const { container } = await render(<RestorableInput />);
    const events = recordInputEvents(container);
    screen.getByTestId<HTMLInputElement>('input').value = restored;

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();
    return events;
  }

  it('sends the events of an input only for a value that the part did not handle', async () => {
    expect(await restore(true, 'handled')).toEqual([]);
  });

  it('sends change, blur and focusout after the input event when the control leaves', async () => {
    expect(await restore(true, 'restored')).toEqual(['input', 'change', 'blur', 'focusout']);
  });

  it('sends only the input event to a hidden input', async () => {
    expect(await restore(false, 'restored')).toEqual(['input']);
  });

  it('sends only the input event to a control that has the focus', async () => {
    const RestorableInput = createRestorableInput(true);
    await render(<RestorableInput />);
    const input = screen.getByTestId<HTMLInputElement>('input');
    input.focus();
    const events = recordInputEvents(input);
    input.value = 'restored';

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(events).toEqual(['input']);
  });
});

describe('VUE-81: a render before the page show', () => {
  const { render } = createRenderer();

  const LEAVES = ['input', 'change', 'blur', 'focusout'];

  function getInputs(container: HTMLElement, name: string) {
    return [...container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
  }

  function readInputs(container: HTMLElement, name: string) {
    return getInputs(container, name).map((input) => input.value);
  }

  it.each<{
    name: string;
    family: FormRestoreFamily;
    inputName: string;
    written: string[];
    model: string;
    changes: string;
    events: string[];
  }>([
    {
      name: 'Field.Control with v-model',
      family: 'field',
      inputName: 'name',
      written: ['restored'],
      model: 'restored',
      changes: 'restored (none)',
      events: LEAVES,
    },
    {
      name: 'Input with v-model',
      family: 'input',
      inputName: 'text',
      written: ['restored'],
      model: 'restored',
      changes: 'restored (none)',
      events: LEAVES,
    },
    {
      name: 'Toolbar.Input with a value',
      family: 'toolbar',
      inputName: 'filter',
      written: ['restored'],
      model: 'restored',
      changes: 'restored (input)',
      events: LEAVES,
    },
    {
      name: 'Toolbar.Input with a default value',
      family: 'toolbar-default',
      inputName: 'filter',
      written: ['restored'],
      model: 'restored',
      changes: 'restored (input)',
      events: LEAVES,
    },
    {
      name: 'Select.Root',
      family: 'select',
      inputName: 'font',
      written: ['mono'],
      model: 'mono',
      changes: 'mono (none)',
      events: ['input'],
    },
    {
      name: 'Combobox.Root',
      family: 'combobox',
      inputName: 'fruit',
      written: ['Cherry'],
      model: 'Cherry',
      changes: 'Cherry (none)',
      events: ['input'],
    },
    {
      name: 'NumberField.Root',
      family: 'number-field',
      inputName: 'quantity',
      written: ['7'],
      model: '7',
      changes: '7 (none)',
      events: ['input'],
    },
    {
      name: 'Slider.Thumb',
      family: 'slider',
      inputName: 'volume',
      written: ['70'],
      model: '70',
      changes: '70 (input-change)',
      events: ['input'],
    },
    {
      name: 'a range slider',
      family: 'range',
      inputName: 'range',
      written: ['30', '60'],
      model: '30,60',
      changes: '30,60 (input-change)',
      events: ['input'],
    },
    {
      name: 'DateField.Root',
      family: 'date-field',
      inputName: 'when',
      written: ['2026-12-25'],
      model: '2026-12-25',
      changes: '2026-12-25 (input-change)',
      events: ['input'],
    },
    {
      name: 'TimeField.Root',
      family: 'time-field',
      inputName: 'alarm',
      written: ['09:30'],
      model: '09:30:00',
      changes: '09:30:00 (input-change)',
      events: ['input'],
    },
  ])(
    'takes the value that the browser restored into $name',
    async ({ family, inputName, written, model, changes, events }) => {
      mockPageBeforeLoad();
      const revision = shallowRef(0);
      const { container } = await render(() => (
        <FormRestoreRender family={family} revision={revision.value} />
      ));
      await flushMicrotasks();
      const recorded = recordInputEvents(container);
      const inputs = getInputs(container, inputName);
      expect(inputs).toHaveLength(written.length);
      written.forEach((text, index) => {
        inputs[index]!.value = text;
      });

      revision.value += 1;
      await flushMicrotasks();
      expect(readInputs(container, inputName)).toEqual(written);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      await flushMicrotasks();

      const fixture = within(container);
      expect(fixture.getByTestId('model').textContent).toBe(model);
      expect(fixture.getByTestId('changes').textContent).toBe(changes);
      expect(recorded).toEqual(events);
    },
  );

  it('keeps the value of a thumb through a render of its input only', async () => {
    mockPageBeforeLoad();
    const locale = shallowRef('en-US');
    const { container } = await render(() => (
      <FormRestoreRender family="slider" revision={0} locale={locale.value} />
    ));
    await flushMicrotasks();
    const recorded = recordInputEvents(container);
    const [input] = getInputs(container, 'volume');
    input!.value = '70';

    locale.value = 'de-DE';
    await flushMicrotasks();
    expect(input).toHaveValue('70');

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(within(container).getByTestId('changes').textContent).toBe('70 (input-change)');
    expect(recorded).toEqual(['input']);
  });

  function renderToolbarInput(props: Ref<{ value?: string; defaultValue?: string }>) {
    const texts: string[] = [];
    return {
      texts,
      result: render(() => (
        <Toolbar.Root>
          <Toolbar.Input
            {...props.value}
            data-testid="input"
            onInput={(event: Event) => {
              texts.push((event.currentTarget as HTMLInputElement).value);
            }}
          />
        </Toolbar.Root>
      )),
    };
  }

  it('takes the value that the browser restored into Toolbar.Input after a new default value', async () => {
    mockPageBeforeLoad();
    const props = shallowRef({ defaultValue: 'a' });
    const { texts, result } = renderToolbarInput(props);
    const { container } = await result;
    const recorded = recordInputEvents(container);
    const input = screen.getByTestId<HTMLInputElement>('input');
    input.value = 'restored';

    props.value = { defaultValue: 'b' };
    await flushMicrotasks();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(input).toHaveValue('restored');
    expect(texts).toEqual(['restored']);
    expect(recorded).toEqual(LEAVES);
  });

  it('sends no event at the page show after a new default value of Toolbar.Input', async () => {
    const props = shallowRef({ defaultValue: 'a' });
    const { result } = renderToolbarInput(props);
    const { container } = await result;
    const recorded = recordInputEvents(container);

    props.value = { defaultValue: 'b' };
    await flushMicrotasks();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveValue('b');
    expect(recorded).toEqual([]);
  });

  it('sends no event at the page show after a new value of Toolbar.Input', async () => {
    mockPageBeforeLoad();
    const props = shallowRef({ value: 'a' });
    const { result } = renderToolbarInput(props);
    const { container } = await result;
    const recorded = recordInputEvents(container);
    screen.getByTestId<HTMLInputElement>('input').value = 'restored';

    props.value = { value: 'b' };
    await flushMicrotasks();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveValue('b');
    expect(recorded).toEqual([]);
  });
});

describe('useFormRestoreAsInput before the page show', () => {
  const { render } = createRenderer();

  function createStatefulInput(value: Ref<string>, revision: Ref<number>) {
    return defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      let handledValue: string | undefined;
      useFormRestoreAsInput(input, () => handledValue, false);
      return () =>
        h('input', {
          value: value.value,
          'data-revision': revision.value,
          'data-testid': 'input',
          ref: (element) => {
            input.value = element as HTMLInputElement | null;
            handledValue = input.value?.value;
          },
          onInput: (event: Event) => {
            handledValue = (event.currentTarget as HTMLInputElement).value;
          },
        });
    });
  }

  async function renderStatefulInput() {
    const value = shallowRef('handled');
    const revision = shallowRef(0);
    const StatefulInput = createStatefulInput(value, revision);
    const { container } = await render(<StatefulInput />);
    const events = recordInputEvents(container);
    const input = screen.getByTestId<HTMLInputElement>('input');
    return { value, revision, input, events };
  }

  it('gives the input a new value of a render over the restored value', async () => {
    mockPageBeforeLoad();
    const { value, input, events } = await renderStatefulInput();
    input.value = 'restored';

    value.value = 'loaded';
    await flushMicrotasks();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(input).toHaveValue('loaded');
    expect(events).toEqual([]);
  });

  it('writes the state over a value of a program after the page show', async () => {
    mockPageBeforeLoad();
    const { revision, input, events } = await renderStatefulInput();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    input.value = 'written';

    revision.value += 1;
    await flushMicrotasks();

    expect(input).toHaveValue('handled');
    expect(events).toEqual([]);
  });

  it('writes the state over a value of a program when the page loaded before the mount', async () => {
    const { revision, input } = await renderStatefulInput();
    input.value = 'written';

    revision.value += 1;
    await flushMicrotasks();

    expect(input).toHaveValue('handled');
  });

  it('writes the state over a value of a program while KeepAlive holds the part', async () => {
    mockPageBeforeLoad();
    const value = shallowRef('handled');
    const revision = shallowRef(0);
    const shown = shallowRef(true);
    const StatefulInput = createStatefulInput(value, revision);
    await render(() => <KeepAlive>{shown.value ? <StatefulInput key="input" /> : null}</KeepAlive>);
    const input = screen.getByTestId<HTMLInputElement>('input');
    input.value = 'written';

    shown.value = false;
    await flushMicrotasks();
    revision.value += 1;
    await flushMicrotasks();

    expect(input).toHaveValue('handled');
  });
});
