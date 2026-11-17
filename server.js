// A small job board: JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadJobs, searchJobs, findJob } from "./lib/jobs.js";
import { createSavedStore } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) {
      const error = new Error("Request body too large");
      error.status = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

// Supplying a store lets tests use an isolated temporary JSON file.
export function createApp({ savedStore = createSavedStore() } = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs();
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }

      if (req.method === "GET" && url.pathname === "/api/saved") {
        const [ids, jobs] = await Promise.all([savedStore.list(), loadJobs()]);
        return sendJson(res, 200, ids.map((id) => findJob(jobs, id)).filter(Boolean));
      }

      if (req.method === "POST" && url.pathname === "/api/saved") {
        const payload = await readJson(req);
        if (!payload || typeof payload.jobId !== "string" || !payload.jobId.trim()) {
          return sendJson(res, 400, { error: "jobId must be a non-empty string" });
        }
        const job = findJob(await loadJobs(), payload.jobId);
        if (!job) return sendJson(res, 404, { error: "Unknown job id" });
        const created = await savedStore.add(job.id);
        return sendJson(res, created ? 201 : 200, job);
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/saved/")) {
        const jobId = decodeURIComponent(url.pathname.slice("/api/saved/".length));
        if (!jobId || jobId.includes("/")) return sendJson(res, 400, { error: "Invalid job id" });
        const removed = await savedStore.remove(jobId);
        return removed
          ? sendJson(res, 200, { removed: true, jobId })
          : sendJson(res, 404, { error: "Job is not saved" });
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (err.status) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
