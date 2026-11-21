import Scenario from '#scenario';
import { count } from '../count.ts';

export function App() {
  return Array.from({ length: count }, (_, instance) => (
    <div key={instance} data-bench="instance">
      <Scenario />
    </div>
  ));
}
