const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const workerNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const d1DatabaseNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function prepareWranglerConfig(source, env = process.env) {
  const config = JSON.parse(source);

  const databaseId = env.OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID;
  if (!databaseId) {
    throw new Error("Missing D1 database_id secret(s):\n- __DB_DATABASE_ID__: set OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID");
  }

  if (!uuidPattern.test(databaseId)) {
    throw new Error("Invalid D1 database_id for DB: expected a UUID.");
  }

  const workerName = env.OPEN_JIGSAW_PUZZLE_WORKER_NAME;
  if (workerName !== undefined && workerName !== "") {
    if (!workerNamePattern.test(workerName)) {
      throw new Error("Invalid Worker name: use lowercase letters, numbers, and dashes; start and end with a letter or number; keep it within 63 characters.");
    }
    config.name = workerName;
  }

  const d1DatabaseName = env.OPEN_JIGSAW_PUZZLE_D1_DATABASE_NAME;
  if (d1DatabaseName !== undefined && d1DatabaseName !== "") {
    if (!d1DatabaseNamePattern.test(d1DatabaseName)) {
      throw new Error("Invalid D1 database name: use lowercase letters, numbers, and dashes; start and end with a letter or number.");
    }
  }

  let dbBindingCount = 0;
  for (const database of config.d1_databases ?? []) {
    if (database.binding !== "DB") {
      continue;
    }
    dbBindingCount += 1;
    database.database_id = databaseId;
    if (d1DatabaseName !== undefined && d1DatabaseName !== "") {
      database.database_name = d1DatabaseName;
    }
  }
  if (dbBindingCount === 0) {
    throw new Error("Missing D1 DB binding in wrangler config.");
  }

  const customDomainHost = env.OPEN_JIGSAW_PUZZLE_CUSTOM_DOMAIN_HOST;
  if (customDomainHost !== undefined && customDomainHost !== "") {
    if (!isValidHostname(customDomainHost)) {
      throw new Error("Invalid custom domain host: use a lowercase hostname without protocol, path, or port.");
    }
    config.workers_dev = false;
    config.routes = [{ pattern: customDomainHost, custom_domain: true }];
  }

  return `${JSON.stringify(config, null, 2)}\n`;
}

function isValidHostname(hostname) {
  if (hostname.length > 253 || hostname.includes("://") || hostname.includes("/") || hostname.includes(":")) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => domainLabelPattern.test(label));
}
