import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Adjust the import to point to the contracts index where schemas are exported.
// Assuming the contracts package has an index.ts that exports all schemas.
// If not, we may need to import each schema individually.
// For simplicity, we'll import the entire contracts module and then filter for Zod schemas.
import * as Contracts from "../packages/contracts";
import { ZodSchema } from "zod";

async function generateTypes() {
  const outDir = join(
    __dirname,
    "..",
    "packages",
    "contracts",
    "src",
    "generated",
  );
  await mkdir(outDir, { recursive: true });

  const generatedFiles: { name: string; content: string }[] = [];

  for (const [name, potentialSchema] of Object.entries(Contracts)) {
    // We assume that any exported value that is a ZodSchema is a schema we want to generate a type for.
    if (potentialSchema instanceof ZodSchema) {
      const typeDef = `export type ${name} = z.infer<typeof ${name}>;\n`;
      generatedFiles.push({ name: `${name}.ts`, content: typeDef });
    }
  }

  // Write an index.ts that re-exports all generated types.
  const indexContent =
    generatedFiles
      .map((f) => `export * from './${f.name.replace(".ts", "")}'`)
      .join("\n") + "\n";

  await Promise.all([
    writeFile(join(outDir, "index.ts"), indexContent),
    ...generatedFiles.map((file) =>
      writeFile(join(outDir, file.name), file.content),
    ),
  ]);

  console.log(`Generated ${generatedFiles.length} type files in ${outDir}`);
}

generateTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
