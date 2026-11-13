import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import { createRenderer, screen } from '#test-utils';
import { useCSPContext } from '../internals/csp-context/CSPContext';

function queryDisableScrollbarStyle() {
  const styles = Array.from(document.querySelectorAll('style'));
  return (
    styles.find((element) => element.textContent?.includes('.vase-ui-disable-scrollbar')) ?? null
  );
}

describe('<CSPProvider />', () => {
  const { render } = createRenderer();

  const Probe = defineComponent(() => {
    const csp = useCSPContext();
    return () => (
      <div
        data-testid="probe"
        data-nonce={csp.value.nonce}
        data-disable-style-elements={String(csp.value.disableStyleElements)}
      />
    );
  });

  it('gives a consumer outside a provider no nonce and disableStyleElements false', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<Probe />);

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-nonce')).toBeNull();
    expect(probe.getAttribute('data-disable-style-elements')).toBe('false');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('gives the nonce and disableStyleElements to a consumer', async () => {
    await render(
      <CSPProvider nonce="test-nonce" disableStyleElements>
        <Probe />
      </CSPProvider>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-nonce')).toBe('test-nonce');
    expect(probe.getAttribute('data-disable-style-elements')).toBe('true');
  });

  it('gives the values of the nearest provider and does not merge them with an outer provider', async () => {
    await render(
      <CSPProvider nonce="outer">
        <CSPProvider disableStyleElements>
          <Probe />
        </CSPProvider>
      </CSPProvider>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-nonce')).toBeNull();
    expect(probe.getAttribute('data-disable-style-elements')).toBe('true');
  });

  it('gives a changed prop to a consumer', async () => {
    const { setProps } = await render(
      <CSPProvider nonce="first">
        <Probe />
      </CSPProvider>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-nonce')).toBe('first');
    expect(probe.getAttribute('data-disable-style-elements')).toBe('false');

    await setProps({ nonce: 'second', disableStyleElements: true });

    expect(probe.getAttribute('data-nonce')).toBe('second');
    expect(probe.getAttribute('data-disable-style-elements')).toBe('true');
  });

  it('does not render inline style tags when disableStyleElements is true', async () => {
    await render(
      <CSPProvider disableStyleElements>
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>,
    );

    expect(queryDisableScrollbarStyle()).toBeNull();
  });

  it('applies nonce to inline style tags', async () => {
    // The shared style element goes away with the last root, so no element exists before the render.
    expect(queryDisableScrollbarStyle()).toBeNull();

    await render(
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>,
    );

    const style = queryDisableScrollbarStyle();
    expect(style).not.toBeNull();
    expect(style).toHaveAttribute('nonce', 'test-nonce');
  });

  it('renders inline style tags by default', async () => {
    expect(queryDisableScrollbarStyle()).toBeNull();

    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport />
      </ScrollArea.Root>,
    );

    expect(queryDisableScrollbarStyle()).not.toBeNull();
  });
});
