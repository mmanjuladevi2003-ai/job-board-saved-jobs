const list = document.getElementById("jobs");
const savedList = document.getElementById("saved-jobs");
const savedCount = document.getElementById("saved-count");
const message = document.getElementById("message");
const search = document.getElementById("search");

let savedJobs = [];
let currentJobs = [];
let searchRequest = 0;

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function jobDetails(job) {
  const details = document.createElement("div");
  const title = document.createElement("div");
  title.className = "job-title";
  title.textContent = job.title;
  const meta = document.createElement("div");
  meta.className = "job-meta";
  meta.textContent = `${job.company} · ${job.location} · ₹${job.stipend.toLocaleString("en-IN")}/month`;
  details.append(title, meta);
  return details;
}

function render() {
  const savedIds = new Set(savedJobs.map((job) => job.id));
  list.replaceChildren();
  savedList.replaceChildren();
  savedCount.textContent = `(${savedJobs.length})`;

  if (!currentJobs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No jobs match your search.";
    list.append(empty);
  }
  for (const job of currentJobs) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const alreadySaved = savedIds.has(job.id);
    button.textContent = alreadySaved ? "Saved ✓" : "Save";
    button.disabled = alreadySaved;
    button.setAttribute("aria-label", alreadySaved ? `${job.title} is saved` : `Save ${job.title}`);
    button.addEventListener("click", () => updateSaved("save", job, button));
    li.append(jobDetails(job), button);
    list.append(li);
  }

  if (!savedJobs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No saved jobs yet. Save one from the list!";
    savedList.append(empty);
  }
  for (const job of savedJobs) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "remove";
    button.textContent = "Remove";
    button.setAttribute("aria-label", `Remove ${job.title}`);
    button.addEventListener("click", () => updateSaved("remove", job, button));
    li.append(jobDetails(job), button);
    savedList.append(li);
  }
}

async function updateSaved(action, job, button) {
  button.disabled = true;
  message.textContent = "";
  try {
    if (action === "save") {
      await api("/api/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
    } else {
      await api(`/api/saved/${encodeURIComponent(job.id)}`, { method: "DELETE" });
    }
    savedJobs = await api("/api/saved");
    render();
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
}

async function showJobs(query = "") {
  const request = ++searchRequest;
  try {
    const jobs = await api(`/api/jobs?q=${encodeURIComponent(query)}`);
    if (request !== searchRequest) return;
    currentJobs = jobs;
    render();
  } catch (error) {
    message.textContent = error.message;
  }
}

search.addEventListener("input", () => showJobs(search.value));

async function init() {
  try {
    savedJobs = await api("/api/saved");
    await showJobs(search.value);
  } catch (error) {
    message.textContent = error.message;
  }
}
init();
