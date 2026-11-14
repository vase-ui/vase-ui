import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import DrawerProvider from './DrawerProvider.vue';
import { useDrawerProviderContext } from './DrawerProviderContext';
import type { DrawerProviderContext } from './DrawerProviderContext';

async function collectGarbage() {
  process.getBuiltinModule('node:v8').setFlagsFromString('--expose-gc');
  const gc = process.getBuiltinModule('node:vm').runInNewContext('gc') as () => void;

  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
    gc();
  }
}

describe('<Drawer.Provider />', () => {
  it('releases closed drawers once they are removed', async () => {
    const drawerRefs: WeakRef<object>[] = [];
    let context!: DrawerProviderContext;
    const Probe = defineComponent({
      setup() {
        context = useDrawerProviderContext()!;
        return () => null;
      },
    });

    await renderToString(
      createSSRApp({
        render: () => (
          <DrawerProvider>
            <Probe />
          </DrawerProvider>
        ),
      }),
    );

    // A variable of the case that holds a drawer keeps it from the garbage collector.
    function registerClosedDrawers() {
      for (let i = 0; i < 10; i += 1) {
        const drawer = {};
        drawerRefs.push(new WeakRef(drawer));
        context.setDrawerOpen(drawer, false);
        context.removeDrawer(drawer);
      }
    }
    registerClosedDrawers();
    expect(drawerRefs).toHaveLength(10);

    await collectGarbage();

    expect(drawerRefs.filter((ref) => ref.deref() !== undefined)).toHaveLength(0);
  });
});
