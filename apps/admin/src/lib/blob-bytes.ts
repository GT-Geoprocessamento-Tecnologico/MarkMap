function readWithFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const { result } = reader;
      if (!(result instanceof ArrayBuffer))
        return reject(new Error("Leitura do arquivo não retornou bytes."));
      resolve(result);
    };
    reader.readAsArrayBuffer(blob);
  });
}

export async function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  if (typeof FileReader !== "undefined") return readWithFileReader(blob);
  const fallback = new Response(blob);
  if (typeof fallback.arrayBuffer === "function") return fallback.arrayBuffer();
  throw new Error("Nenhum leitor de Blob disponível neste ambiente.");
}
