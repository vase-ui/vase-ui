import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createHeldBranch,
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

function createRestorable(onRestore: (event?: PageTransitionEvent) => void) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormRestore(input, onRestore);
    return () => renderInput(input);
  });
}

function createRestorableInput(leaves: boolean) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    const { valueProps } = useFormRestoreAsInput(input, () => 'handled', leaves);
    return () => h('input', { ...valueProps(), 'data-testid': 'input', ref: input });
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

  it('does not call the callback while KeepAlive holds a part that mounted in a held branch', async () => {
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => <Restorable />);
    await render(<HeldBranch />);

    await mountWhileHeld();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));

    expect(handleRestore).not.toHaveBeenCalled();

    await show();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));

    expect(handleRestore).toHaveBeenCalledTimes(1);
  });

  it('calls the callback with no event at the activation after a page show while KeepAlive held the part', async () => {
    const showPage = mockPageBeforeLoad();
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    const { HeldBranch, hide, show } = createHeldBranch(() => <Restorable />, { mounted: true });
    await render(<HeldBranch />);

    await hide();
    showPage();

    expect(handleRestore).not.toHaveBeenCalled();

    await show();

    expect(handleRestore.mock.calls).toEqual([[]]);
  });

  it('calls the callback one time after a page show while KeepAlive held the part', async () => {
    const showPage = mockPageBeforeLoad();
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    const { HeldBranch, hide, show } = createHeldBranch(() => <Restorable />, { mounted: true });
    await render(<HeldBranch />);
    await hide();
    showPage();
    await show();

    await hide();
    await show();

    expect(handleRestore).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback at an activation after the part got the page show', async () => {
    const showPage = mockPageBeforeLoad();
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    const { HeldBranch, hide, show } = createHeldBranch(() => <Restorable />, { mounted: true });
    await render(<HeldBranch />);
    showPage();

    await hide();
    await show();

    expect(handleRestore.mock.calls).toEqual([[expect.objectContaining({ type: 'pageshow' })]]);
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

const LEAVES = ['input', 'change', 'blur', 'focusout'];

function getInputs(container: HTMLElement, name: string) {
  return [...container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
}

function readInputs(container: HTMLElement, name: string) {
  return getInputs(container, name).map((input) => input.value);
}

interface RestoredFamily {
  name: string;
  family: FormRestoreFamily;
  inputName: string;
  written: string[];
  model: string;
  changes: string;
  events: string[];
}

const RESTORED_FAMILIES: RestoredFamily[] = [
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
];

describe('VUE-81: a render before the page show', () => {
  const { render } = createRenderer();

  it.each([{ name: 'Toolbar.Input', family: 'toolbar-default', inputName: 'filter' }] as const)(
    'takes only a silent edit of uncontrolled $name',
    async ({ family, inputName }) => {
      const { container } = await render(<FormRestoreRender family={family} revision={0} />);
      const [input] = getInputs(container, inputName);
      input!.value = 'typed';
      input!.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushMicrotasks();
      const events = recordInputEvents(container);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      expect(events).toEqual([]);

      input!.value = input!.defaultValue;
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      expect(events).toEqual(LEAVES);
    },
  );

  it.each([
    {
      name: 'Toolbar.Input',
      Part: Toolbar.Input,
      Root: Toolbar.Root,
      valueProps: { value: 'model' },
    },
  ])('starts a replacement $name with its own value', async ({ Part, Root, valueProps }) => {
    mockPageBeforeLoad();
    const tag = shallowRef<'input' | 'textarea'>('input');
    const { container } = await render(() => (
      <Root>
        <Part as={tag.value} aria-label="controlled" {...valueProps} />
        <Part as={tag.value} aria-label="uncontrolled" defaultValue="default" />
      </Root>
    ));
    const controlled = screen.getByLabelText<HTMLInputElement>('controlled');
    const uncontrolled = screen.getByLabelText<HTMLInputElement>('uncontrolled');
    uncontrolled.value = 'typed';
    uncontrolled.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flushMicrotasks();
    controlled.value = 'restored';

    tag.value = 'textarea';
    await flushMicrotasks();
    const events = recordInputEvents(container);
    expect(screen.getByLabelText('controlled')).toHaveValue('model');
    expect(screen.getByLabelText('uncontrolled')).toHaveValue('default');

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();
    expect(events).toEqual([]);
  });

  it.each(RESTORED_FAMILIES)(
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
});

describe('VUE-81: a part that KeepAlive holds at the page show', () => {
  const { render } = createRenderer();

  it.each(RESTORED_FAMILIES)(
    'takes the value that the browser restored into $name at its activation',
    async ({ family, inputName, written, model, changes, events }) => {
      const showPage = mockPageBeforeLoad();
      const revision = shallowRef(0);
      const { HeldBranch, hide, show } = createHeldBranch(
        () => <FormRestoreRender family={family} revision={revision.value} />,
        { mounted: true },
      );
      const { container } = await render(<HeldBranch />);
      await flushMicrotasks();
      const recorded = recordInputEvents(container);
      const inputs = getInputs(container, inputName);
      expect(inputs).toHaveLength(written.length);
      written.forEach((text, index) => {
        inputs[index]!.value = text;
      });

      await hide();
      revision.value += 1;
      await flushMicrotasks();
      expect(inputs.map((input) => input.value)).toEqual(written);

      showPage();
      await show();
      await flushMicrotasks();

      const fixture = within(container);
      expect(fixture.getByTestId('model').textContent).toBe(model);
      expect(fixture.getByTestId('changes').textContent).toBe(changes);
      expect(recorded).toEqual(events);
    },
  );
});

describe('useFormRestoreAsInput before the page show', () => {
  const { render } = createRenderer();

  function createStatefulInput(value: Ref<string>, revision: Ref<number>) {
    return defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      const { valueProps } = useFormRestoreAsInput(input, () => value.value, false);
      return () =>
        h('input', {
          ...valueProps(),
          'data-revision': revision.value,
          'data-testid': 'input',
          ref: (element) => {
            input.value = element as HTMLInputElement | null;
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

  it('keeps the native reset value through a render before pageshow', async () => {
    const showPage = mockPageBeforeLoad();
    const value = shallowRef('server');
    const revision = shallowRef(0);
    const Control = createStatefulInput(value, revision);
    const { container } = await render(
      <form>
        <Control />
      </form>,
    );
    const input = screen.getByTestId<HTMLInputElement>('input');
    const events = recordInputEvents(container);
    input.value = 'restored';

    revision.value += 1;
    await flushMicrotasks();
    expect(input.value).toBe('restored');
    expect(input.defaultValue).toBe('server');

    input.form!.reset();
    showPage();
    await flushMicrotasks();
    expect(input.value).toBe('server');
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

  async function renderHeldStatefulInput() {
    const revision = shallowRef(0);
    const StatefulInput = createStatefulInput(shallowRef('handled'), revision);
    const { HeldBranch, hide, show } = createHeldBranch(() => <StatefulInput />, {
      mounted: true,
    });
    const { container } = await render(<HeldBranch />);
    const events = recordInputEvents(container);
    const input = screen.getByTestId<HTMLInputElement>('input');
    return { revision, input, events, hide, show };
  }

  it('keeps a value that the part did not handle while KeepAlive holds it, and takes it at the activation after the page show', async () => {
    const showPage = mockPageBeforeLoad();
    const { revision, input, events, hide, show } = await renderHeldStatefulInput();
    input.value = 'restored';

    await hide();
    revision.value += 1;
    await flushMicrotasks();

    expect(input).toHaveValue('restored');

    showPage();
    await show();
    await flushMicrotasks();

    expect(input).toHaveValue('restored');
    expect(events).toEqual(['input']);
  });

  it('keeps a value that the part did not handle while KeepAlive holds it, and takes it at a page show after the activation', async () => {
    const showPage = mockPageBeforeLoad();
    const { revision, input, events, hide, show } = await renderHeldStatefulInput();
    input.value = 'restored';
    await hide();
    revision.value += 1;
    await flushMicrotasks();

    await show();

    expect(events).toEqual([]);

    showPage();
    await flushMicrotasks();

    expect(input).toHaveValue('restored');
    expect(events).toEqual(['input']);
  });

  it('writes the state over a value of a program while KeepAlive holds the part after the page show', async () => {
    const showPage = mockPageBeforeLoad();
    const { revision, input, events, hide } = await renderHeldStatefulInput();
    showPage();
    input.value = 'written';

    await hide();
    revision.value += 1;
    await flushMicrotasks();

    expect(input).toHaveValue('handled');
    expect(events).toEqual([]);
  });
});
