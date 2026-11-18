import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, hydrateAfter, isVaporApp, renderOnServer, screen } from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import CheckboxRoot from '../checkbox/root/CheckboxRoot.vue';
import CheckedInputSyncPart from './CheckedInputSyncPart.test.vue';
import CheckedInputSyncPartVapor from './CheckedInputSyncPartVapor.test.vue';
import type { useCheckedInputSync } from './useCheckedInputSync';

const FIXTURE = 'src/internals/CheckedInputSyncPart.test.vue';

describe('useCheckedInputSync', () => {
  const { render } = createRenderer();

  async function mount(Part: Component, indeterminate = false) {
    const report = vi.fn<(sync: ReturnType<typeof useCheckedInputSync>) => void>();
    const take = vi.fn();
    const { setProps } = await render(h(Part, { checked: true, indeterminate, take, report }));
    return {
      input: screen.getByRole<HTMLInputElement>('checkbox'),
      write: report.mock.calls[0][0].write,
      take,
      setProps,
    };
  }

  async function checkMount(Part: Component) {
    const { input, write, take } = await mount(Part);
    expect(input.defaultChecked).toBe(false);
    expect(input.checked).toBe(true);
    expect(take).not.toHaveBeenCalled();
    const checkedWrites = recordInputWrites(input, 'checked');
    const mixedWrites = recordInputWrites(input, 'indeterminate');

    write();

    expect(checkedWrites).toEqual([]);
    expect(mixedWrites).toEqual([]);
  }

  it('writes the state at mount and skips an equal state', () => checkMount(CheckedInputSyncPart));

  it.runIf(isVaporApp)('writes the state at mount in a Vapor part', () =>
    checkMount(CheckedInputSyncPartVapor),
  );

  it.each([
    { name: 'with a take', takes: true },
    { name: 'without a take', takes: false },
  ])('hydrates a changed checkbox $name', async ({ takes }) => {
    const props = { checked: false };
    const take = vi.fn();
    const serverHtml = await renderOnServer(FIXTURE, props);
    let assignments: (string | boolean)[] = [];
    const { container } = await hydrateAfter(CheckedInputSyncPart, {
      serverHtml,
      props: { ...props, take: takes ? take : undefined },
      before(server) {
        const input = server.querySelector('input')!;
        input.click();
        assignments = recordInputWrites(input, 'checked');
      },
    });

    expect(take).toHaveBeenCalledTimes(takes ? 1 : 0);
    expect(container.querySelector('input')!.checked).toBe(takes);
    expect(assignments).toEqual(takes ? [] : [false]);
  });

  it('puts indeterminate back after a click clears it', async () => {
    const { input, write } = await mount(CheckedInputSyncPart, true);
    expect(input.indeterminate).toBe(true);
    input.click();
    expect(input.indeterminate).toBe(false);

    write();

    expect(input.indeterminate).toBe(true);
    expect(input.checked).toBe(true);
  });

  it('writes a change of indeterminate after the render', async () => {
    const { input, setProps } = await mount(CheckedInputSyncPart);
    expect(input.indeterminate).toBe(false);
    await setProps({ indeterminate: true });
    expect(input.indeterminate).toBe(true);
  });
});

describe('checkedInputProps', () => {
  const { render } = createRenderer();

  it('keeps the input style of a named parent checkbox', async () => {
    const { container } = await render(<CheckboxRoot parent name="fruit" />);
    const input = container.querySelector('input')!;
    expect(input).not.toHaveAttribute('name');
    expect(input).toHaveStyle({ position: 'absolute', width: '1px' });
  });
});
