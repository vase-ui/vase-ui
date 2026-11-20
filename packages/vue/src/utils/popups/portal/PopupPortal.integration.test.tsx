import { describe, expect, it } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createScrollDocument } from '../../../../test/fixtures/scrollDocument';
import { Toast } from '@vase-ui/vue/toast';
import { createRenderer, screen } from '#test-utils';

describe('PopupPortal parts', () => {
  const { render } = createRenderer();

  it('VUE-128: renders a guard-free portal inline even with a null target', async () => {
    await render(() => (
      <section data-testid="source">
        <Toast.Portal to={null} disabled data-testid="portal" />
      </section>
    ));
    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('source'));
  });

  it('VUE-168: resolves a selector whose target mounts later in the same update', async () => {
    const show = shallowRef(false);
    await render(() => (
      <main>
        <Toast.Portal to={show.value ? '#late-portal-target' : null} data-testid="portal" />
        {show.value && <div id="late-portal-target" data-testid="target" />}
      </main>
    ));

    show.value = true;
    await nextTick();
    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('target'));
  });

  it('VUE-168: resolves a nested selector in the new document when its parent portal moves', async () => {
    const first = await createScrollDocument();
    const second = await createScrollDocument();
    const to = shallowRef(first.body);
    first.reference.id = 'nested-portal-target';
    second.reference.id = 'nested-portal-target';
    await render(() => (
      <Toast.Portal to={to.value}>
        <Toast.Portal to="#nested-portal-target" data-testid="nested" />
      </Toast.Portal>
    ));
    const nested = first.reference.querySelector('[data-testid="nested"]');
    expect(nested).toBeTruthy();

    to.value = second.body;
    await nextTick();
    expect(second.reference.querySelector('[data-testid="nested"]')).toBe(nested);
  });
});
