import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { useTestDismiss } from '../../../../test/fixtures/useTestDismiss';

const Popup = defineComponent({
  setup() {
    const store = useFloatingRootStore({ open: true });
    const { reference, floating } = useTestDismiss(store);
    return () => (
      <>
        <button {...reference}>trigger</button>
        <div {...floating}>popup</div>
      </>
    );
  },
});

describe('useDismissLayer on a server', () => {
  it('renders an open popup with no listener attribute and takes no number for it', async () => {
    const html = await renderToString(createSSRApp(Popup));

    expect(html).toBe('<!--[--><button>trigger</button><div>popup</div><!--]-->');
    expect(Symbol.for('vase-ui.popup-layers') in globalThis).toBe(false);
  });
});
