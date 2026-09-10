import type { Database } from "./index";

export async function checkDatabase(db: Database): Promise<"ok" | "error"> {
  try {
    await db.run("select 1");
    return "ok";
  } catch {
    return "error";
  }
}
