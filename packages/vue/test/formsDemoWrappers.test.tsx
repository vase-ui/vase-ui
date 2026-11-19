import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import '../../../docs/demos/tailwind.css';
import * as Combobox from '../../../docs/demos/handbook-forms/components/combobox';
import * as Field from '../../../docs/demos/handbook-forms/components/field';
import Hero from '../../../docs/demos/handbook-forms/hero/tailwind/index.vue';

describe('the wrappers of the Forms demos', () => {
  const { render } = createRenderer();

  function renderHero() {
    return render(h('div', { 'data-demo': 'tailwind' }, h(Hero)));
  }

  it('gives the #item slot to Combobox.List', async () => {
    const { user } = await renderHero();

    await user.click(screen.getByRole('combobox', { name: 'Region' }));

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(27);
    expect(options[0]).toHaveTextContent('us-central-1');
    expect(getComputedStyle(options[0]).display).toBe('grid');
  });

  it('gives the #item slot to Autocomplete.List', async () => {
    const { user } = await renderHero();

    await user.click(screen.getByRole('combobox', { name: 'Container image' }));
    await user.keyboard('n');

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('nginx:1.29-alpine');
    expect(options[0]).toHaveTextContent('docker.io/library/nginx:1.29-alpine');
    expect(getComputedStyle(options[0]).flexDirection).toBe('column');
  });

  it('gives the props and the content of the element slot of Fieldset.Root to the wrapper, and puts the class of the wrapper first', async () => {
    await renderHero();

    const group = screen.getByRole('group', { name: 'Scaling threshold' });
    expect(group.tagName).toBe('DIV');
    expect(group.className).toBe('grid grid-cols-2 w-full gap-y-2');
    expect(group.querySelectorAll('input[type="range"]')).toHaveLength(2);
    expect(screen.getByRole('radiogroup', { name: 'Storage type' }).className).toBe(
      'flex w-full flex-row items-start gap-1 text-neutral-950 dark:text-white gap-4',
    );
  });

  it('gives a slot that the caller adds after the mount to the part', async () => {
    const { setProps } = await render(<DescriptionWithSlot useRender={false} />);

    expect(screen.getByTestId('description').tagName).toBe('P');
    expect(screen.getByTestId('description')).toHaveTextContent('plain');

    await setProps({ useRender: true });
    await flushMicrotasks();

    expect(screen.getByTestId('description').tagName).toBe('SPAN');
    expect(screen.getByTestId('description')).toHaveTextContent('custom');
    expect(screen.getByTestId('description')).toHaveClass('text-sm');
  });

  it('gives the clear button of Combobox a name', async () => {
    const { user } = await renderHero();

    await user.click(screen.getByRole('combobox', { name: 'Region' }));
    await user.click(await screen.findByRole('option', { name: 'us-central-1' }));

    expect(await screen.findByRole('button', { name: 'Clear selection' })).toBeVisible();
  });

  it('gives the #render slot to Combobox.Clear and Combobox.Empty', async () => {
    await render(<ClearAndEmptyWithRender />);

    expect(screen.getByTestId('clear')).toHaveAttribute('aria-label', 'Clear selection');
    expect(screen.getByTestId('empty')).toHaveAttribute('role', 'status');
  });
});

interface RenderSlotProps {
  props: object;
  children: Component;
}

function ClearAndEmptyWithRender() {
  return (
    <Combobox.Root items={[]}>
      <Combobox.Clear
        keepMounted
        v-slots={{
          render: ({ props, children }: RenderSlotProps) => (
            <button {...props} data-testid="clear">
              {h(children)}
            </button>
          ),
        }}
      />
      <Combobox.Empty
        v-slots={{
          render: ({ props, children }: RenderSlotProps) => (
            <div {...props} data-testid="empty">
              {h(children)}
            </div>
          ),
        }}
      />
    </Combobox.Root>
  );
}

function DescriptionWithSlot({ useRender }: { useRender: boolean }) {
  return (
    <Field.Root>
      <Field.Description
        data-testid="description"
        v-slots={
          useRender
            ? {
                element: ({
                  props,
                  elementRef,
                }: {
                  props: object;
                  elementRef: (target: unknown) => void;
                }) => (
                  <span {...props} ref={elementRef}>
                    custom
                  </span>
                ),
              }
            : { default: () => 'plain' }
        }
      />
    </Field.Root>
  );
}
