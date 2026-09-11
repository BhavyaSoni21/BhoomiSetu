// Not an HTTP e2e test - named *.e2e-spec.ts anyway because that's the only
// pattern this project's jest config (backend/package.json) picks up (see
// testRegex: 'test/.*\\.e2e-spec\\.ts$'; there's no separate unit-test
// runner here). Exercises the local-disk storage fallback directly.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;

import * as path from 'path';
import * as fs from 'fs/promises';
import { uploadToStorage, downloadFromStorage } from '../src/common/supabase-storage';

const LOCAL_FALLBACK_DIR = path.resolve(process.cwd(), 'uploads');

describe('Local-disk storage fallback (KNOWN_RISKS.md HIGH-4)', () => {
  it('writes and reads back a normal relative key under the fallback dir', async () => {
    const key = `storage-test/${Date.now()}.png`;
    await uploadToStorage(key, Buffer.from('hello'), 'image/png');
    const read = await downloadFromStorage(key);
    expect(read.toString()).toBe('hello');
    await fs.rm(path.join(LOCAL_FALLBACK_DIR, 'storage-test'), { recursive: true, force: true });
  });

  it('refuses to write a key whose relative path walks outside the fallback dir', async () => {
    // Same shape as the crafted Content-Type-derived key from
    // workflows.controller.ts's create() - an extension containing '../'
    // segments, joined onto an otherwise-normal-looking prefix.
    const key = `workflow-evidence/${Date.now()}.` + '../../../../../../tmp/hs-audit-traversal-poc';
    await expect(uploadToStorage(key, Buffer.from('malicious'), 'image/png')).rejects.toThrow(
      /outside the local fallback directory/,
    );
  });

  it('refuses to read a key whose relative path walks outside the fallback dir', async () => {
    const key = '../../../../../../etc/passwd';
    await expect(downloadFromStorage(key)).rejects.toThrow(/outside the local fallback directory/);
  });
});
