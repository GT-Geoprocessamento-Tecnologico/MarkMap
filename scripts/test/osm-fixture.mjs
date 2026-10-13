function v(n) {
  let x = BigInt(n); const bytes = [];
  while (x >= 128n) { bytes.push(Number(x & 127n) | 128); x >>= 7n; }
  bytes.push(Number(x)); return Buffer.from(bytes);
}
function zi(n) { const x = BigInt(n); return x < 0n ? -2n * x - 1n : 2n * x; }
const field = (n, value) => Buffer.concat([v(n * 8), v(value)]);
const bytes = (n, data) => { const raw = Buffer.isBuffer(data) ? data : Buffer.from(data); return Buffer.concat([v(n * 8 + 2), v(raw.length), raw]); };
const parts = (...p) => Buffer.concat(p);
function osmFixture() {
  const strings = ['', 'highway', 'residential', 'name', 'Rua de Teste', 'leisure', 'park', 'amenity', 'cafe', 'Café'];
  const table = parts(...strings.map((x) => bytes(1, x)));
  const nodes = [
    [10, -23.5000, -46.6000],
    [11, -23.5001, -46.5998],
    [12, -23.5003, -46.6000],
    [13, -23.4997, -46.5999],
  ];
  const deltas = (at) => {
    let prev = 0;
    return parts(...nodes.map((node) => { const val = Math.round(node[at] * 1e7); const delta = val - prev; prev = val; return v(zi(delta)); }));
  };
  const dense = parts(
    bytes(1, parts(v(zi(10)), v(zi(1)), v(zi(1)), v(zi(1)))),
    bytes(8, deltas(1)), bytes(9, deltas(2)),
    bytes(10, parts(v(0), v(0), v(0), v(7), v(8), v(3), v(9), v(0))),
  );
  const road = parts(field(1, 100), bytes(2, parts(v(1), v(3))), bytes(3, parts(v(2), v(4))),
    bytes(8, parts(v(zi(10)), v(zi(3)))));
  const park = parts(field(1, 101), bytes(2, v(5)), bytes(3, v(6)),
    bytes(8, parts(v(zi(10)), v(zi(1)), v(zi(1)), v(zi(-2)))));
  const group = parts(bytes(2, dense), bytes(3, road), bytes(3, park));
  const primitive = parts(bytes(1, table), bytes(2, group));
  const wrap = (type, payload) => {
    const blob = bytes(1, payload);
    const header = parts(bytes(1, type), field(3, blob.length));
    const len = Buffer.alloc(4); len.writeUInt32BE(header.length);
    return parts(len, header, blob);
  };
  return parts(wrap('OSMHeader', Buffer.alloc(0)), wrap('OSMData', primitive));
}

export { osmFixture };
