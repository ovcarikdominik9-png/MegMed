// Spustenie testov v termináli: node tests/run-node.mjs
import { tests } from './plan.test.js';
let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log('✓', t.name); }
  catch (e) { failed++; console.log('✗', t.name, '\n ', e.message); }
}
console.log(`\n${tests.length - failed} / ${tests.length} testov prešlo`);
process.exit(failed ? 1 : 0);
