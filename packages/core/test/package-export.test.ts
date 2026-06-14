import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('core package export', () => {
  it('resolves the package root in Node', async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      '--input-type=module',
      '-e',
      `
        import { STREAM_STATE_SCHEMA_VERSION, stableStringify } from '@world-instrument/core';

        console.log(JSON.stringify({
          schema: STREAM_STATE_SCHEMA_VERSION,
          stable: stableStringify({ b: 2, a: 1 }),
        }));
      `,
    ]);

    expect(JSON.parse(stdout.trim())).toEqual({
      schema: 'stream-state.v1',
      stable: '{"a":1,"b":2}',
    });
  });
});
