import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

test("VITE_API_URL sets the built default server and invitation behavior", async (t) => {
  const original = process.env.VITE_API_URL;
  t.after(() => {
    if (original === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = original;
  });

  for (const value of [undefined, "", "https://API.EXAMPLE.TEST:443/"]) {
    if (value === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = value;
    const result = await build({
      configFile: false,
      envDir: false,
      logLevel: "silent",
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(
            new URL("../src/invitations.ts", import.meta.url),
          ),
          formats: ["es"],
        },
      },
    });
    assert.ok(Array.isArray(result));
    const chunk = result[0].output.find((item) => item.type === "chunk");
    assert.ok(chunk?.type === "chunk");
    const { WAPPY_SERVER, formatInvitation, parseInvitation } = await import(
      `data:text/javascript,${encodeURIComponent(chunk.code)}`
    );
    assert.equal(
      WAPPY_SERVER,
      value ? "https://api.example.test" : "http://localhost:3001",
    );
    assert.equal(formatInvitation(WAPPY_SERVER, "a7k3m"), "A7K3M");
    assert.deepEqual(
      parseInvitation(formatInvitation("https://other.test", "a7k3m")),
      { server: "https://other.test", code: "A7K3M" },
    );
  }
});
