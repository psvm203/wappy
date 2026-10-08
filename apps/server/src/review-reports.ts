import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createReports } from "./reports.ts";

const [command, id, action, ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !(
    (command === "list" && !id) ||
    (command === "show" && id && !action) ||
    (command === "resolve" &&
      id &&
      (action === "remove" || action === "dismiss"))
  )
) {
  console.error(
    "Usage: pnpm --filter server reports list | show <report-id> | resolve <report-id> <remove|dismiss>",
  );
  process.exitCode = 1;
} else {
  const path = resolve(process.env.DATABASE_PATH ?? "./data/wappy.sqlite");
  let db: DatabaseSync | undefined;
  try {
    if (!existsSync(path))
      throw new Error("The server database does not exist.");
    db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (
      !db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'chat_reports'",
        )
        .get()
    )
      throw new Error("Start the updated server once to migrate its database.");
    const reports = createReports(db);
    if (command === "resolve")
      reports.resolve(id!, action as "remove" | "dismiss");
    const result =
      command === "list" ? reports.pending() : reports.inspect(id!);
    if (!result) throw new Error("Report not found or expired.");
    // JSON escaping keeps user content from emitting terminal control sequences.
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Report review failed.",
    );
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
