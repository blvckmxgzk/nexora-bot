const entryFile =
  process.argv[1] ??
  "";

export const runtimeModuleRoot =
  entryFile.endsWith(
    ".ts",
  )
    ? "src"
    : "dist";

export const runtimeModuleExtension =
  runtimeModuleRoot ===
  "src"
    ? ".ts"
    : ".js";

export function isRuntimeModuleFile(
  filename: string,
): boolean {
  return filename.endsWith(
    runtimeModuleExtension,
  );
}
