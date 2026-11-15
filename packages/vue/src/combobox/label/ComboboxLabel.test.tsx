import { expect, vi, describe, it } from 'vitest';
import { createApp, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
} from '#test-utils';

const message =
  'Vase UI: <Combobox.Label> labels <Combobox.Trigger> only, and <Combobox.Input> is the form control of this combobox.';

describe('<Combobox.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root>
          {node}
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
    },
  }));

  it('warns without relying on React.captureOwnerStack when labeling an external input', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <Combobox.Root>
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.Input />
      </Combobox.Root>,
    );

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(message));
  });

  it('warns when an input outside the popup mounts after the label', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const showInput = shallowRef(false);
    await render(() => (
      <Combobox.Root>
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.Trigger>Open</Combobox.Trigger>
        {showInput.value && <Combobox.Input />}
      </Combobox.Root>
    ));
    expect(errorSpy).not.toHaveBeenCalled();

    showInput.value = true;
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(message));
  });

  it('derives its id from the root, and ignores an id of the consumer', async () => {
    // The props type of the label has no `id`, so only an untyped consumer can give one.
    const untypedAttributes: object = { id: 'custom' };
    await render(
      <Combobox.Root id="fruit">
        <Combobox.Label {...untypedAttributes} data-testid="label">
          Fruit
        </Combobox.Label>
        <Combobox.Trigger data-testid="trigger" />
      </Combobox.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('id', 'fruit-label');
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', 'fruit-label');
  });

  it('does not name the trigger while KeepAlive holds a label that mounted in a held branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Combobox.Label key="label" data-testid="label">
        Fruit
      </Combobox.Label>
    ));
    await render(() => (
      <Combobox.Root>
        <HeldBranch />
        <Combobox.Trigger data-testid="trigger" />
      </Combobox.Root>
    ));
    const trigger = screen.getByTestId('trigger');

    await mountWhileHeld();
    expect(trigger).not.toHaveAttribute('aria-labelledby');

    await show();
    expect(trigger).toHaveAttribute('aria-labelledby', screen.getByTestId('label').id);
  });

  it('names a portaled input from a label that mounts after it in an app in a detached element', async () => {
    const labelMounted = shallowRef(false);
    const container = document.createElement('div');
    const app = createApp(() => (
      <Field.Root>
        <Combobox.Root>
          {labelMounted.value && <Combobox.Label data-testid="label">Fruit</Combobox.Label>}
          <Combobox.Portal keepMounted>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));
    app.mount(container);
    try {
      await flushMicrotasks();
      labelMounted.value = true;
      await flushMicrotasks();
      document.body.append(container);
      await flushMicrotasks();

      expect(document.querySelector('[data-testid="input"]')).toHaveAttribute(
        'aria-labelledby',
        container.querySelector('[data-testid="label"]')?.id,
      );
    } finally {
      app.unmount();
      container.remove();
    }
  });
});
