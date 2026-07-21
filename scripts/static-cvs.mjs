import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPeriod(startDate, endDate) {
  const value = (date) => date === "present" ? "Present" : String(date || "");
  return [value(startDate), value(endDate)].filter(Boolean).join(" – ");
}

function itemValue(item) {
  return item.content?.text || item.content?.name || item.content?.institution || "";
}

function groupExperience(selections) {
  const employers = new Map();
  for (const item of selections.filter((selection) => selection.section === "experience")) {
    const group = item.group || item.block?.grouping || {};
    const employerId = group.employerId || group.employer || "employment";
    const occasionId = group.occasionId || `${employerId}-${group.role || "role"}`;
    if (!employers.has(employerId)) {
      employers.set(employerId, { employer: group.employer || "Employment", occasions: new Map() });
    }
    const employer = employers.get(employerId);
    if (!employer.occasions.has(occasionId)) {
      employer.occasions.set(occasionId, { ...group, items: [] });
    }
    employer.occasions.get(occasionId).items.push(item);
  }
  return [...employers.values()].map((employer) => ({
    employer: employer.employer,
    occasions: [...employer.occasions.values()],
  }));
}

export function renderStaticCv(document) {
  const basics = document.profile?.basics || {};
  const selections = [...(document.selections || [])]
    .sort((left, right) => left.section.localeCompare(right.section) || left.order - right.order);
  const sections = Object.groupBy(selections, (item) => item.section);
  const experience = groupExperience(selections);
  const title = `${basics.name || document.name} — CV`;
  const contacts = [
    basics.email ? `<a href="mailto:${escapeHtml(basics.email)}">${escapeHtml(basics.email)}</a>` : "",
    basics.phone ? `<a href="tel:${escapeHtml(basics.phone)}">${escapeHtml(basics.phone)}</a>` : "",
    basics.url ? `<a href="${escapeHtml(basics.url)}">${escapeHtml(basics.url)}</a>` : "",
  ].filter(Boolean).join("");
  const experienceHtml = experience.length ? `
    <section><h2>Experience</h2>${experience.map((employer) => `
      <article class="employer"><h3>${escapeHtml(employer.employer)}</h3>${employer.occasions.map((occasion) => `
        <section class="role"><div><h4>${escapeHtml(occasion.role)}</h4><p>${escapeHtml(formatPeriod(occasion.startDate, occasion.endDate))}</p></div>
          <ul>${occasion.items.map((item) => `<li>${escapeHtml(itemValue(item))}</li>`).join("")}</ul>
        </section>`).join("")}</article>`).join("")}</section>` : "";
  const sidebar = ["skills", "certifications", "education", "interests"]
    .filter((section) => sections[section]?.length)
    .map((section) => `<section><h2>${escapeHtml(section)}</h2><ul>${sections[section]
      .map((item) => `<li>${escapeHtml(itemValue(item))}</li>`).join("")}</ul></section>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="description" content="${escapeHtml(document.summary || basics.summary || title)}">
<title>${escapeHtml(title)}</title><link rel="icon" href="/favicon.ico"><style>
:root{color-scheme:light;font-family:Arial,sans-serif;color:#19221f;background:#f3ecdf}*{box-sizing:border-box}body{margin:0;padding:2rem}a{color:inherit}.actions{max-width:210mm;margin:0 auto 1rem;text-align:right}.cv{max-width:210mm;min-height:280mm;margin:auto;padding:18mm;background:#fff;border:1px solid #d9dedb;box-shadow:0 18px 50px #16201c1a}.hero{display:flex;justify-content:space-between;gap:2rem;padding-bottom:1.5rem;border-bottom:3px solid #345c4b}.hero h1{margin:0;font-size:clamp(2.4rem,7vw,4.8rem);line-height:.9}.eyebrow,h2{color:#345c4b;text-transform:uppercase;letter-spacing:.1em;font-size:.75rem}.role-label{font-size:1.15rem}.contacts{display:grid;align-content:end;text-align:right;font-size:.8rem}.grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(12rem,.8fr);gap:2.4rem;margin-top:2rem}.employer{padding-bottom:1rem;border-bottom:1px solid #dde2df}.role>div{display:flex;justify-content:space-between;align-items:baseline;gap:1rem}.role h4,.role p{margin:.4rem 0;font-size:.85rem}.cv li,.cv main>section>p{font-size:.86rem;line-height:1.6}@media(max-width:700px){body{padding:0}.cv{min-height:0;padding:1.5rem}.hero,.grid{display:grid;grid-template-columns:1fr}.contacts{text-align:left}}@media print{body{padding:0;background:#fff}.actions{display:none}.cv{min-height:0;max-width:none;margin:0;padding:10mm;border:0;box-shadow:none}.employer,.role,li{break-inside:avoid}}
</style></head><body><nav class="actions"><button onclick="window.print()">Print / save PDF</button></nav><article class="cv">
<header class="hero"><div><p class="eyebrow">Curriculum vitae</p><h1>${escapeHtml(basics.name || document.name)}</h1><p class="role-label">${escapeHtml(basics.label)}</p></div><address class="contacts">${contacts}</address></header>
<div class="grid"><main>${document.summary || basics.summary ? `<section><h2>Profile</h2><p>${escapeHtml(document.summary || basics.summary)}</p></section>` : ""}${experienceHtml}</main><aside>${sidebar}</aside></div>
</article></body></html>`;
}

async function rpc({ supabaseUrl, serviceRoleKey, fetchImpl, name, body = {} }) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Static CV RPC ${name} failed (${response.status}).`);
  return response.json();
}

export async function generateStaticCvs({
  outDir,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl = fetch,
}) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Static CV generation requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const cvRoot = join(outDir, "cv");
  await rm(cvRoot, { recursive: true, force: true });
  const rows = await rpc({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl,
    name: "list_published_cv_slugs_for_build",
  });
  const slugs = (rows || []).map((row) => typeof row === "string" ? row : row.slug).filter(Boolean);
  for (const slug of slugs) {
    const document = await rpc({
      supabaseUrl,
      serviceRoleKey,
      fetchImpl,
      name: "get_published_cv",
      body: { p_slug: slug },
    });
    if (!document || document.status !== "published") continue;
    const page = join(cvRoot, slug, "index.html");
    await mkdir(dirname(page), { recursive: true });
    await writeFile(page, renderStaticCv(document), "utf8");
  }
  return { generated: slugs };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const required = process.env.STATIC_CV_GENERATION_REQUIRED === "true";
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    if (required) throw new Error("Static CV generation is required but its server-only Supabase environment is missing.");
    console.warn("Skipping static CV generation: server-only Supabase build environment is not configured.");
  } else {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const result = await generateStaticCvs({
      outDir: join(root, "dist"),
      supabaseUrl,
      serviceRoleKey,
    });
    console.log(`Generated ${result.generated.length} static CV page(s).`);
  }
}
