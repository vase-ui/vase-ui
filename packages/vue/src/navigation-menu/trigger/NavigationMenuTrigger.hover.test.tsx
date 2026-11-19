import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSSRApp } from 'vue';
import { renderOnServer, takeReportedMessages, waitFor, within } from '#test-utils';
import { allowTopLevelViewportWarning } from '../../../test/navigation-menuTestUtils';
import NavigationMenuTriggerHydration from './NavigationMenuTriggerHydration.test.vue';

describe('<NavigationMenu.Trigger />', () => {
  it('VUE-7: opens its item when the pointer is over the trigger as the hydration ends', async () => {
    allowTopLevelViewportWarning();
    const serverHtml = await renderOnServer(
      'src/navigation-menu/trigger/NavigationMenuTriggerHydration.test.vue',
    );
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = serverHtml;
    const trigger = within(container).getByTestId('trigger-one');
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
