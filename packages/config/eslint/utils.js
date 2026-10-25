import { createRequire } from 'node:module';

/**
 * Safely attempts to load `eslint-plugin-react-hooks`.
 * Returns the module if installed, or null if missing.
 *
 * @param {string} metaUrl - The `import.meta.url` of the caller config file.
 * @returns {object|null}
 */
export function loadReactHooksPlugin(metaUrl) {
  const require = createRequire(metaUrl);
  try {
    return require('eslint-plugin-react-hooks');
  } catch {
    return null;
  }
}
