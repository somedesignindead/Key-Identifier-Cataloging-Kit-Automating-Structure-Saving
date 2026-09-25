import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../converter/runtime.mjs';
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('playwright/package.json')),'cli.js');
const result = spawnSync(process.execPath,[cli,'install','chromium','--only-shell'],{
  stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:join(ROOT,'.runtime/browsers')},
});
process.exitCode=result.status ?? 1;
