# MM-SEARCH provider provenance

The first-party function uses two fixed public upstreams for user-submitted,
non-autocomplete searches:

- BrasilAPI CEP v2 (`brasilapi.com.br/api/cep/v2`) for exact eight-digit
  Brazilian CEPs. The hosted service is beta and requests must resemble a
  human lookup; the adapter therefore applies a 30/minute per-instance
  upstream cap, bounded cache, timeout, and response validation. Coordinates
  may arrive as numeric strings and are parsed only after a strict non-empty
  decimal-string check. Returned postal codes are always eight digits; the
  display layer may format them separately. See the [BrasilAPI README](https://github.com/BrasilAPI/BrasilAPI/blob/main/README.md)
  and [MIT license](https://raw.githubusercontent.com/BrasilAPI/BrasilAPI/main/LICENSE).
- Photon (`photon.komoot.io`) for a submitted free-form address/place query,
  plus an optional CEP fallback only when the returned postcode exactly
  matches the requested CEP and the feature has real point coordinates. The
  public demo welcomes reasonable project use but warns that extensive use
  may be throttled or banned and availability is not guaranteed. See the
  [Photon terms](https://photon.komoot.io/) and
  [Photon README](https://github.com/komoot/photon/blob/master/README.md).

Results carry source and attribution metadata. Public Nominatim is not used.
The in-memory cache stores only positive responses and is bounded to 128
entries (24 hours for CEP and one hour for free-form address), client traffic is limited to 12 requests per minute,
upstream traffic to 30 requests per minute per warm function instance, and
upstream concurrency to four. The adapter allows up to 6 seconds per provider
and 8 seconds total; the Vercel function must remain within a 10-second
platform budget. These are process-local protections in a serverless
deployment, not a distributed quota or availability guarantee.
