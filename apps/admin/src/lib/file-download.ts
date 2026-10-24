/** Keep Blob links alive while Safari hands the file to its download manager. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    anchor.remove();
  }
  // Revoking in the click's task can invalidate an asynchronous WebKit download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
