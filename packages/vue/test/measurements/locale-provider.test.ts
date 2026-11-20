// Measurements with plain Vue, with no code of the library, for `LocaleProvider`. Each one states
// what Vue does, so that the provider has code only where Vue does not do it.
import { describe, expect, inject, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import MeasureProvideAcrossModes from '../fixtures/MeasureProvideAcrossModes.vue';
import MeasureVaporInjector from '../fixtures/MeasureVaporInjector.vue';
import MeasureVaporProvider from '../fixtures/MeasureVaporProvider.vue';
import { VdomInjector, VdomProvider } from '../fixtures/measureProvide';
import { hydrate, mount, renderOnServer } from '../render';

const texts = (root: Element) => [...root.querySelectorAll('span')].map((span) => span.textContent);

// Only an app with the interop plugin of Vue 3.6 renders a virtual DOM component and a Vapor
// component together: the setups "vapor app, vdom parts" and "vdom app, vapor parts".
describe.runIf(inject('app').endsWith('interop'))('provide and inject across modes', () => {
  test('the components have the modes that the cases name', () => {
    const isVapor = (component: object) => (component as { __vapor?: boolean }).__vapor === true;
    const components = [VdomProvider, VdomInjector, MeasureVaporProvider, MeasureVaporInjector];
    expect(components.map(isVapor)).toEqual([false, false, true, true]);
  });

  test('a provider of one mode reaches an injector of the other mode, and a change reaches it', async () => {
    const scene = reactive({ text: 'de-DE' });
    const { root } = mount(MeasureProvideAcrossModes, { scene });
    expect(texts(root)).toEqual(['de-DE', 'de-DE']);
    scene.text = 'fr-FR';
    await nextTick();
    expect(texts(root)).toEqual(['fr-FR', 'fr-FR']);
  });

  test('the server HTML has the provided value, and the hydration gives no message', async () => {
    const root = await renderOnServer('MeasureProvideAcrossModes', { scene: { text: 'de-DE' } });
    expect(texts(root)).toEqual(['de-DE', 'de-DE']);
    const scene = reactive({ text: 'de-DE' });
    hydrate(MeasureProvideAcrossModes, { scene }, root);
    await nextTick();
    expect(texts(root)).toEqual(['de-DE', 'de-DE']);
    scene.text = 'fr-FR';
    await nextTick();
    expect(texts(root)).toEqual(['fr-FR', 'fr-FR']);
  });
});
