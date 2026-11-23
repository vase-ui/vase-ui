// A measurement of the frame samples: a reversed transition and a restarted keyframe animation.
import { appendFileSync } from 'node:fs';
import { installRecorder } from './behavior/recorder.ts';
import { DURATION, largestFrameGap, largestJump } from './behavior/samples.ts';
import { browserTypeOf } from './runner.ts';

const PAGE = `<style>
#t { opacity: 1; transition: opacity 500ms linear; }
#t.hidden { opacity: 0; }
@keyframes out { from { opacity: 1; } to { opacity: 0; } }
@keyframes in { from { opacity: 0; } to { opacity: 1; } }
#k.out { animation: out 500ms linear forwards; }
#k.in { animation: in 500ms linear forwards; }
</style><div id="t" data-bench="t">T</div><div id="k" data-bench="k">K</div>`;

const engine = process.argv[2] ?? 'chromium';
const browser = await browserTypeOf(engine).launch();
const lines: string[] = [];
for (let run = 1; run <= 10; run++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(installRecorder);
  const page = await context.newPage();
  await page.setContent(PAGE);
  await page.evaluate(() => {
    window.behaviorRecorder.start(['t', 'k']);
    requestAnimationFrame(() => {
      document.getElementById('t')?.classList.add('hidden');
      document.getElementById('k')?.classList.add('out');
      setTimeout(() => {
        document.getElementById('t')?.classList.remove('hidden');
        document.getElementById('k')?.classList.replace('out', 'in');
      }, 250);
    });
  });
  await page.waitForTimeout(900);
  const recording = await page.evaluate(() => window.behaviorRecorder.stop());
  lines.push(
    `| ${engine} | ${String(run)} | ${largestJump(recording.frames, 't', DURATION).toFixed(3)} | ${largestJump(recording.frames, 'k', DURATION).toFixed(3)} | ${largestFrameGap(recording.frames).toFixed(1)} | ${String(recording.frames.length)} |`,
  );
  await context.close();
}
await browser.close();
const table = [
  `| Engine | Run | Reversed transition | Restarted animation | Largest frame gap (ms) | Frames |`,
  '| --- | --- | --- | --- | --- | --- |',
  ...lines,
].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
}
