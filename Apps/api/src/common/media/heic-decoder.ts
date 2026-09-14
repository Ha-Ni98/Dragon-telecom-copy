import { logger } from '@common/config/logger';

// S26.1 / owner decision Q1 — sharp's prebuilt libvips ships WITHOUT HEIF decode (patent
// licensing), so sharp(heicBuffer) throws. iPhones upload HEIC by default, so rejecting it
// outright would make the phone-photo path unusable; instead HEIC is transcoded to JPEG here
// and the rest of the pipeline is unchanged.
//
// Two guards, both because of the 1 GB Fly machine:
//  1. `await import()` — the wasm libheif build is only resident once a HEIC actually arrives.
//  2. `queue` — libheif's peak RSS scales with pixel count (a 12 MP still decodes to ~48 MB of
//     RGBA before re-encoding). Two concurrent decodes are what would actually OOM the machine,
//     so decodes are serialised into a single chain. Uploads are an admin action measured in
//     handfuls per day; the queueing cost is irrelevant.
let queue: Promise<unknown> = Promise.resolve();

export async function decodeHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const run = queue.then(async () => {
    const heicConvert = (await import('heic-convert')).default;
    logger.debug('Decoding HEIC upload via heic-convert');
    // heic-convert's types declare `buffer: ArrayBufferLike`, which a Node Buffer (a Uint8Array
    // view, not an ArrayBuffer itself) does not satisfy — slice out the exact backing range
    // rather than `buffer.buffer`, which may be a larger shared pool.
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const output = await heicConvert({ buffer: arrayBuffer, format: 'JPEG', quality: 1 });
    return Buffer.from(output);
  });
  // Keep the chain alive even when this decode rejects, so one bad file does not wedge the queue.
  queue = run.catch(() => undefined);
  return run;
}
