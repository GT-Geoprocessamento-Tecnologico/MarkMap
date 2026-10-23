import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  handleAddressSearch,
  normalizeCep,
  resetAddressSearchState,
} from "./address-search.js";

function response(status, body) {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return new Response(bytes, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function invoke(url, fetcher, headers = {}) {
  const output = { statusCode: 0, headers: {}, body: "" };
  const res = {
    set statusCode(value) {
      output.statusCode = value;
    },
    setHeader(name, value) {
      output.headers[name] = value;
    },
    end(value) {
      output.body = value;
    },
  };
  return handleAddressSearch({ method: "GET", url, headers }, res, {
    fetcher,
  }).then(() => ({ ...output, json: JSON.parse(output.body) }));
}

beforeEach(() => resetAddressSearchState());

test("normalizes only complete Brazilian CEPs", () => {
  assert.equal(normalizeCep("01311-000"), "01311000");
  assert.equal(normalizeCep("01311 000"), "01311000");
  assert.equal(normalizeCep("01311"), null);
  assert.equal(normalizeCep("01311abc"), null);
});

test("adapts BrasilAPI numeric-string coordinates", async () => {
  const result = await invoke(
    "/api/address-search?q=01311-000&limit=5",
    async () =>
      response(200, {
        cep: "01311000",
        street: "Avenida Paulista",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        location: {
          type: "Point",
          coordinates: { longitude: "-46.63611", latitude: "-23.5475" },
        },
      }),
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.json[0].postalCode, "01311000");
  assert.equal(result.json[0].lon, -46.63611);
  assert.equal(typeof result.json[0].lat, "number");
});

test("supports Araguaína CEP and rejects unusable BrasilAPI coordinates", async () => {
  const calls = [];
  const result = await invoke(
    "/api/address-search?q=77800-000",
    async (url) => {
      calls.push(String(url));
      if (calls.length === 1)
        return response(200, {
          cep: "77800000",
          street: "Rua Principal",
          city: "Araguaína",
          state: "TO",
          location: {
            coordinates: { longitude: "-48.2078", latitude: "-7.1911" },
          },
        });
      return response(200, { type: "FeatureCollection", features: [] });
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.json[0].postalCode, "77800000");

  resetAddressSearchState();
  const invalid = await invoke("/api/address-search?q=77800000", async () =>
    response(200, {
      cep: "77800000",
      street: "Rua Principal",
      location: { coordinates: { longitude: "", latitude: null } },
    }),
  );
  assert.deepEqual(invalid.json, []);
});

test("uses Photon for submitted free-form query and preserves attribution", async () => {
  const result = await invoke(
    "/api/address-search?q=Avenida%20Paulista&limit=1",
    async (url, init) => {
      assert.match(String(url), /^https:\/\/photon\.komoot\.io\/api\/\?q=/);
      assert.equal(
        init.headers["User-Agent"],
        "MarkMap (+https://appmarkmap.mtsferreira.dev; address-search)",
      );
      assert.equal(init.headers["Accept-Language"], "pt-BR,pt;q=0.9,en;q=0.7");
      return response(200, {
        type: "FeatureCollection",
        features: [
          {
            geometry: { type: "Point", coordinates: [-46.6556, -23.5618] },
            properties: {
              name: "MASP",
              street: "Av. Paulista",
              housenumber: "1578",
              city: "São Paulo",
              postcode: "01310-200",
            },
          },
        ],
      });
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.json[0].postalCode, "01310200");
  assert.match(result.json[0].attribution, /OpenStreetMap/);
});

test("rejects cross-site browser requests without calling upstream", async () => {
  let called = false;
  const result = await invoke(
    "/api/address-search?q=Rua%20Augusta",
    async () => {
      called = true;
      return response(200, {});
    },
    {
      "sec-fetch-site": "cross-site",
      origin: "https://evil.example",
      host: "appmarkmap.mtsferreira.dev",
    },
  );
  assert.equal(result.statusCode, 403);
  assert.equal(called, false);
});

test("caps oversized upstream bodies", async () => {
  const result = await invoke(
    "/api/address-search?q=Rua%20Augusta",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(129 * 1024));
            controller.close();
          },
        }),
        { status: 200 },
      ),
  );
  assert.equal(result.statusCode, 502);
});

test("classifies timeout without logging query or upstream URL", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (line) => warnings.push(String(line));
  try {
    const result = await invoke(
      "/api/address-search?q=Segredo%20Rua%20Tocantins",
      async () => {
        throw new DOMException("aborted", "AbortError");
      },
    );
    assert.equal(result.statusCode, 502);
    assert.equal(result.json.error.code, "UPSTREAM_TIMEOUT");
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(
      warnings[0],
      /Segredo|Tocantins|photon|brasilapi|https?:/i,
    );
    assert.match(warnings[0], /requestId|kind|code|elapsedMs/);
  } finally {
    console.warn = originalWarn;
  }
});

test("rejects partial numeric CEP without calling Photon", async () => {
  let called = false;
  const result = await invoke("/api/address-search?q=01311", async () => {
    called = true;
    return response(200, {});
  });
  assert.equal(result.statusCode, 400);
  assert.equal(called, false);
});

test("falls back to Photon after BrasilAPI failure only with matching CEP", async () => {
  const calls = [];
  const result = await invoke("/api/address-search?q=77800000", async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return response(503, { error: "temporary" });
    return response(200, {
      type: "FeatureCollection",
      features: [
        {
          geometry: { type: "Point", coordinates: [-48.2, -7.19] },
          properties: {
            name: "Araguaína",
            postcode: "77800-000",
            osm_type: "N",
            osm_id: 123,
          },
        },
        {
          geometry: { type: "Point", coordinates: [-48.2, -7.19] },
          properties: { name: "Wrong", postcode: "77801-000" },
        },
      ],
    });
  });
  assert.equal(result.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(result.json.length, 1);
  assert.equal(result.json[0].postalCode, "77800000");
  assert.match(result.json[0].id, /^[a-f0-9]{64}$/);
});

test("returns stable rate-limit headers", async () => {
  const fetcher = async () =>
    response(200, { type: "FeatureCollection", features: [] });
  for (let i = 0; i < 12; i += 1)
    await invoke(`/api/address-search?q=Rua%20${i}`, fetcher);
  const result = await invoke("/api/address-search?q=Rua%20blocked", fetcher);
  assert.equal(result.statusCode, 429);
  assert.equal(result.headers["Retry-After"], "60");
});

test("reuses cache within the bounded cache and upstream window", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return response(200, {
      type: "FeatureCollection",
      features: [
        {
          geometry: { type: "Point", coordinates: [-48.2, -7.19] },
          properties: { name: "Cache result" },
        },
      ],
    });
  };
  await invoke("/api/address-search?q=Cache%20first", fetcher);
  await invoke("/api/address-search?q=Cache%20first", fetcher);
  assert.equal(calls, 1);
  for (let i = 0; i < 28; i += 1)
    await invoke(`/api/address-search?q=Cache%20${i}`, fetcher, {
      "x-forwarded-for": `10.0.0.${i}`,
    });
  await invoke("/api/address-search?q=Cache%20first", fetcher, {
    "x-forwarded-for": "10.0.0.255",
  });
  assert.equal(calls, 29);
});

test("caps concurrent upstream calls at four", async () => {
  let active = 0;
  let peak = 0;
  const fetcher = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 25));
    active -= 1;
    return response(200, { type: "FeatureCollection", features: [] });
  };
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      invoke(`/api/address-search?q=Concurrent%20${i}`, fetcher, {
        "x-forwarded-for": `192.0.2.${i}`,
      }),
    ),
  );
  assert.equal(peak, 4);
});
