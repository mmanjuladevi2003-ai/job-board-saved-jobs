// File-backed saved job IDs. A queue serializes writes to avoid lost updates.
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, basename, join } from "node:path";

export function createSavedStore(path = new URL("../saved-jobs.json", import.meta.url)) {
  let pending = Promise.resolve();

  async function readIds() {
    try {
      const ids = JSON.parse(await readFile(path, "utf8"));
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
        throw new Error("Invalid saved-jobs file");
      }
      return ids;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeIds(ids) {
    const filePath = path instanceof URL ? fileURLToPath(path) : path;
    const temp = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temp, `${JSON.stringify(ids, null, 2)}\n`, "utf8");
      await rename(temp, filePath);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      throw error;
    }
  }

  function enqueue(action) {
    const task = pending.then(action);
    pending = task.catch(() => {});
    return task;
  }

  return {
    list: () => pending.then(readIds),
    add: (id) => enqueue(async () => {
      const ids = await readIds();
      if (ids.includes(id)) return false;
      ids.push(id);
      await writeIds(ids);
      return true;
    }),
    remove: (id) => enqueue(async () => {
      const ids = await readIds();
      if (!ids.includes(id)) return false;
      await writeIds(ids.filter((savedId) => savedId !== id));
      return true;
    }),
  };
}
