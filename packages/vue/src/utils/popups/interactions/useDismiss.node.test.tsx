import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { useDismiss } from './useDismiss';

const Popup = defineComponent({
  setup() {
    const store = useFloatingRootStore({ open: true });
    const { reference, floating } = useDismiss(store);
    return () => (
      <>
        <button {...reference}>trigger</button>
        <div {...floating}>popup</div>
      </>
    );
  },
});

describe('useDismiss on a server', () => {
  it('renders an open popup with no listener attribute and takes no number for it', async () => {
    const html = await renderToString(createSSRApp(Popup));

    expect(html).toBe('<!--[--><button>trigger</button><div>popup</div><!--]-->');
    expect(Symbol.for('vase-ui.escape-layers') in globalThis).toBe(false);
  });
});
