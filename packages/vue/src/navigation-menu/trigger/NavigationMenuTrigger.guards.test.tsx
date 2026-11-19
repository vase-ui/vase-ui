import { expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';

const { render } = createRenderer();

it('moves focus through the replacement trigger and viewport in both directions', async () => {
  const version = shallowRef(1);
  const { user } = await render(() => (
    <div>
      <NavigationMenu.Root defaultValue="one">
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger key={version.value}>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport key={version.value} id={`viewport-${version.value}`} />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
      <button type="button">Outside</button>
    </div>
  ));
  const oldTrigger = screen.getByRole('button', { name: 'One' });
  const oldGuard = oldTrigger.nextElementSibling;
  expect(oldGuard).toHaveAttribute('data-vase-ui-focus-guard');

  version.value += 1;
  await flushMicrotasks();
  expect(oldGuard).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'One' });
  expect(trigger.nextElementSibling?.nextElementSibling).toHaveAttribute('aria-owns', 'viewport-2');
  trigger.focus();
  await user.tab();
  expect(screen.getByRole('link', { name: 'Link' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(trigger).toHaveFocus();

  screen.getByRole('button', { name: 'Outside' }).focus();
  await flushMicrotasks();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
