import { defineLoader } from 'vitepress';
import { loadBenchmarksReport } from '../scripts/docs/benchmarksReport.ts';
import type { BenchmarksReport } from '../scripts/docs/benchmarksReport.ts';

declare const data: BenchmarksReport;
export { data };

export default defineLoader({
  watch: ['../benchmarks/results.json', '../benchmarks/features.json'],
  load: () => loadBenchmarksReport(),
});
