// macOS feasibility check: render the real character SVGs using public AppKit APIs.
// No app profile, WebView storage, screen capture, or Accessibility permission is used.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

if (process.platform !== "darwin") {
  console.error(
    "This AppKit check requires macOS and Xcode Command Line Tools.",
  );
  process.exitCode = 1;
} else {
  const directory = mkdtempSync(join(tmpdir(), "wappy-public-overlay-"));
  try {
    const source = readFileSync(
      new URL("../src/Character.tsx", import.meta.url),
      "utf8",
    );
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(
        '"react/jsx-runtime"',
        JSON.stringify(import.meta.resolve("react/jsx-runtime")),
      )
      .replace(
        '"@wappy/api"',
        JSON.stringify(import.meta.resolve("@wappy/api")),
      );
    const component = join(directory, "Character.mjs");
    writeFileSync(component, compiled);
    const { Character } = await import(pathToFileURL(component).href);
    for (const kind of ["bunny", "cat", "bear", "frog"])
      for (const asleep of [false, true]) {
        const svg = renderToStaticMarkup(
          createElement(Character, { kind, asleep }),
        ).replace(
          "<svg ",
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="110" ',
        );
        writeFileSync(
          join(directory, `${kind}-${asleep ? "asleep" : "awake"}.svg`),
          svg,
        );
      }
    const binary = join(directory, "public-overlay");
    execFileSync(
      "xcrun",
      [
        "swiftc",
        "-parse-as-library",
        fileURLToPath(
          new URL(
            "../src-tauri/examples/public-overlay.swift",
            import.meta.url,
          ),
        ),
        "-o",
        binary,
      ],
      { stdio: "inherit" },
    );
    execFileSync(binary, [directory], { stdio: "inherit", timeout: 15_000 });
    console.log(`Public AppKit overlay check passed. Artifacts: ${directory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`Check artifacts: ${directory}`);
    process.exitCode = 1;
  }
}
