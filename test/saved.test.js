import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";
import { createSavedStore } from "../lib/saved.js";

async function withApp(run) {
  const directory = await mkdtemp(join(tmpdir(), "job-board-test-"));
  const file = join(directory, "saved.json");
  const app = createApp({ savedStore: createSavedStore(file) });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const request = async (path, options) => {
    const response = await fetch(base + path, options);
    return { status: response.status, data: await response.json() };
  };
  const post = (jobId) => request("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  try {
    await run({ request, post, file, directory });
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

test("saved list starts empty and GET returns full job details", async () => {
  await withApp(async ({ request, post }) => {
    assert.deepEqual((await request("/api/saved")).data, []);
    const created = await post("j2");
    assert.equal(created.status, 201);
    assert.equal(created.data.title, "Frontend Developer Intern");
    const list = await request("/api/saved");
    assert.equal(list.status, 200);
    assert.deepEqual(list.data.map((job) => job.id), ["j2"]);
    assert.equal(list.data[0].company, "Kite Learning");
  });
});

test("saving a duplicate keeps exactly one job", async () => {
  await withApp(async ({ request, post }) => {
    assert.equal((await post("j1")).status, 201);
    assert.equal((await post("j1")).status, 200);
    assert.deepEqual((await request("/api/saved")).data.map((job) => job.id), ["j1"]);
  });
});

test("unknown and invalid IDs return clear client errors", async () => {
  await withApp(async ({ request, post }) => {
    assert.deepEqual(await post("no-such-job"), { status: 404, data: { error: "Unknown job id" } });
    assert.equal((await post(42)).status, 400);
    assert.equal((await post("")).status, 400);
    const malformed = await request("/api/saved", { method: "POST", body: "{" });
    assert.deepEqual(malformed, { status: 400, data: { error: "Invalid JSON body" } });
    assert.deepEqual((await request("/api/saved")).data, []);
  });
});

test("DELETE removes a saved job and missing removals return 404", async () => {
  await withApp(async ({ request, post }) => {
    await post("j1");
    await post("j2");
    assert.deepEqual(await request("/api/saved/j1", { method: "DELETE" }), {
      status: 200, data: { removed: true, jobId: "j1" },
    });
    assert.deepEqual((await request("/api/saved")).data.map((job) => job.id), ["j2"]);
    assert.equal((await request("/api/saved/j1", { method: "DELETE" })).status, 404);
  });
});

test("saved jobs survive a new store instance and are valid JSON on disk", async () => {
  await withApp(async ({ post, file }) => {
    await post("j3");
    await post("j6");
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["j3", "j6"]);
    assert.deepEqual(await createSavedStore(file).list(), ["j3", "j6"]);
  });
});

test("concurrent saves preserve every distinct job and deduplicate", async () => {
  await withApp(async ({ request, post }) => {
    const results = await Promise.all([post("j1"), post("j2"), post("j3"), post("j1")]);
    assert.ok(results.every((result) => [200, 201].includes(result.status)));
    assert.deepEqual((await request("/api/saved")).data.map((job) => job.id).sort(), ["j1", "j2", "j3"]);
  });
});

test("existing search endpoint still works", async () => {
  await withApp(async ({ request }) => {
    const result = await request("/api/jobs?q=REMOTE");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.map((job) => job.id), ["j1", "j3", "j6", "j8"]);
  });
});
