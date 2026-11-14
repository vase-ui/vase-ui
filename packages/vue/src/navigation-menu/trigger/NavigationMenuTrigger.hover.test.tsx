import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSSRApp } from 'vue';
import { renderOnServer, takeReportedMessages, waitFor, within } from '#test-utils';
import NavigationMenuTriggerHydration from './NavigationMenuTriggerHydration.test.vue';

// The pointer of the browser stays where a case leaves it, for each later test. A call with no
// coordinates would move the pointer to the element of the last press, which is gone by then.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<NavigationMenu.Trigger />', () => {
  it('VUE-7: opens its item when the pointer is over the trigger as the hydration ends', async () => {
    const serverHtml = await renderOnServer(
      'src/navigation-menu/trigger/NavigationMenuTriggerHydration.test.vue',
    );
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = serverHtml;
    const trigger = within(container).getByTestId('trigger-one');
    releasePointerAfterTest();
    await userEvent.hover(trigger);
    expect(trigger.matches(':hover')).toBe(true);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const app = createSSRApp(NavigationMenuTriggerHydration);
    onTestFinished(() => {
      app.unmount();
      container.remove();
    });
    app.mount(container);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
    // A mismatch makes Vue discard the server nodes and render new nodes.
    expect(within(container).getByTestId('trigger-one')).toBe(trigger);
    expect(takeReportedMessages()).toEqual([]);
  });
});
