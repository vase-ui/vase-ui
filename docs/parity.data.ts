import { defineLoader } from 'vitepress';
import { loadParityReport } from '../scripts/docs/parityReport.ts';
import type { ParityReport } from '../scripts/docs/parityReport.ts';

declare const data: ParityReport;
export { data };

export default defineLoader({
  watch: ['../parity/**/*.json'],
  load: () => loadParityReport(),
});
