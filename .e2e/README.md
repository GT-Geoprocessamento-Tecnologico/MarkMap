# End-to-End Tests

This directory contains Playwright end-to-end tests for the GeoNexo admin application.

To run the tests:

```bash
# Install dependencies (if not already)
pnpm install

# Run the tests in headed mode (for debugging)
pnpm e2e

# Or run in headless CI mode
pnpm e2e:ci
```