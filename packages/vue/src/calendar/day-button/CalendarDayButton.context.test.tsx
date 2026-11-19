import { expect, it } from 'vitest';
import { createRenderer, expectSetupErrorWarnings, takeReportedMessages } from '#test-utils';
import { Calendar } from '@vase-ui/vue/calendar';

const { render } = createRenderer();

it('names the missing root when the day button has no ancestors', async () => {
  await expect(render(<Calendar.DayButton />)).rejects.toThrow(
    'Vase UI: A part of Calendar must be inside <Calendar.Root>.',
  );
  expectSetupErrorWarnings(takeReportedMessages());
});
