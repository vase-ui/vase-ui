import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, hydrate, renderOnServer, within } from '#test-utils';
import UseFormatLocaleProbe from './UseFormatLocaleProbe.test.vue';
import { useFormatLocale } from './useFormatLocale';

describe('useFormatLocale', () => {
  const { render } = createRenderer();

  it('returns en-US for the first render of a client-only mount, then the runtime locale', async () => {
    const locales: (Intl.LocalesArgument | undefined)[] = [];

    const TestComponent = defineComponent(() => {
      const formatLocale = useFormatLocale(undefined);

      return () => {
        locales.push(formatLocale.value);
        return null;
      };
    });

    await render(<TestComponent />);

    expect(locales).toEqual(['en-US', undefined]);
  });

  it.each([
    { name: 'en-US until hydrated without a locale', locale: undefined, hydrated: undefined },
    { name: 'the passed locale while hydrating', locale: 'fr-FR', hydrated: 'fr-FR' },
  ])('returns $name', async ({ locale, hydrated }) => {
    const hydrating = locale ?? 'en-US';
    const serverHtml = await renderOnServer('src/utils/UseFormatLocaleProbe.test.vue', { locale });
    expect(serverHtml).toBe(`<span data-testid="locale">${hydrating}</span>`);

    const { container } = await hydrate(UseFormatLocaleProbe, { serverHtml, props: { locale } });

    expect(within(container).getByTestId('locale').textContent).toBe(String(hydrated));
  });
});
