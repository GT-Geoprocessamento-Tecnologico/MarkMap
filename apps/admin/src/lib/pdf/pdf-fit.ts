// Desenvolvido por MtsFerreira. Fit only the preview, never change PDF bytes.
export function fitPdfToViewport(
  pageWidth: number,
  pageHeight: number,
  screenWidth: number,
  screenHeight: number,
) {
  if (
    ![pageWidth, pageHeight, screenWidth, screenHeight].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return { width: 1, height: 1 };
  const scale = Math.min(1, screenWidth / pageWidth, screenHeight / pageHeight);
  return { width: pageWidth * scale, height: pageHeight * scale };
}
