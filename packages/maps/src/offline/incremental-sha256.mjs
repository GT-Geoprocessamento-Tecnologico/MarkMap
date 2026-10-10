/**
 * Portable incremental SHA-256 for bounded offline packages.
 * Uses constant-size working memory, without buffering entire PMTiles blobs.
 * Integrity checksum only: not an authentication/signature mechanism.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotate = (v, n) => (v >>> n) | (v << (32 - n));

export class IncrementalSha256 {
  constructor() {
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    this.words = new Uint32Array(64);
    this.buffer = new Uint8Array(64);
    this.buffered = 0;
    this.totalBytes = 0;
    this.finished = null;
  }

  transform(data, offset) {
    const w = this.words;
    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4;
      w[i] = ((data[at] << 24) | (data[at + 1] << 16) |
        (data[at + 2] << 8) | data[at + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    const local = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) this.h[i] = (this.h[i] + local[i]) >>> 0;
  }

  update(bytes) {
    if (this.finished !== null) throw new Error('SHA-256 already finalized');
    if (!(bytes instanceof Uint8Array)) throw new TypeError('SHA-256 requires Uint8Array');
    if (!Number.isSafeInteger(this.totalBytes + bytes.byteLength))
      throw new RangeError('SHA-256 input exceeds safe length');
    this.totalBytes += bytes.byteLength;
    let at = 0;
    if (this.buffered) {
      const n = Math.min(64 - this.buffered, bytes.byteLength);
      this.buffer.set(bytes.subarray(0, n), this.buffered);
      this.buffered += n; at += n;
      if (this.buffered === 64) {
        this.transform(this.buffer, 0);
        this.buffered = 0;
      }
    }
    while (at + 64 <= bytes.byteLength) {
      this.transform(bytes, at);
      at += 64;
    }
    if (at < bytes.byteLength) {
      this.buffer.set(bytes.subarray(at), 0);
      this.buffered = bytes.byteLength - at;
    }
    return this;
  }

  digestHex() {
    if (this.finished !== null) return this.finished;
    const bitLength = BigInt(this.totalBytes) * 8n;
    this.buffer[this.buffered++] = 0x80;
    if (this.buffered > 56) {
      this.buffer.fill(0, this.buffered);
      this.transform(this.buffer, 0);
      this.buffered = 0;
    }
    this.buffer.fill(0, this.buffered, 56);
    for (let i = 0; i < 8; i++)
      this.buffer[56 + i] = Number((bitLength >> BigInt((7 - i) * 8)) & 255n);
    this.transform(this.buffer, 0);
    this.finished = [...this.h].map((n) => n.toString(16).padStart(8, '0')).join('');
    return this.finished;
  }
}

export async function sha256Blob(blob, chunkSize = 1024 * 1024) {
  if (!(blob instanceof Blob)) throw new TypeError('Expected Blob');
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || chunkSize > 4 * 1024 * 1024)
    throw new RangeError('Invalid SHA-256 chunk size');
  const hasher = new IncrementalSha256();
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const slice = blob.slice(offset, Math.min(offset + chunkSize, blob.size));
    hasher.update(new Uint8Array(await slice.arrayBuffer()));
  }
  return hasher.digestHex();
}
