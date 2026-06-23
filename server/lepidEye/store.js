const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const dbPath = path.join(process.cwd(), "database.db");
const db = new Database(dbPath);

const PIE_PALETTE = [
  {
    color: "rgba(255,255,255,0.94)",
    topStart: "#ffffff",
    topEnd: "#dfe5ef",
    sideStart: "#d1d7e2",
    sideEnd: "#707885"
  },
  {
    color: "rgba(186, 222, 255, 0.95)",
    topStart: "#d7ecff",
    topEnd: "#8db9e6",
    sideStart: "#95b8db",
    sideEnd: "#53687e"
  },
  {
    color: "rgba(255,255,255,0.62)",
    topStart: "#d6d7da",
    topEnd: "#92979f",
    sideStart: "#9298a2",
    sideEnd: "#535861"
  }
];

const EVENT_COLOR_FALLBACKS = {
  core: "rgb(235, 244, 255)",
  non_core: "rgb(166, 204, 245)",
  support: "rgb(189, 198, 214)"
};

const PLAN_COLOR_FALLBACKS = {
  primary: "rgb(168, 214, 255)",
  active: "rgb(194, 209, 235)",
  inactive: "rgb(160, 172, 198)",
  done: "rgb(225, 234, 244)"
};

const ACCESS_LEVELS = new Set(["low", "medium", "high", "creator"]);

function maskMinor(major) {
  return `${major} / ??`;
}

function getBeijingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";

  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    0,
    0
  );
}

function getBeijingSliceEnd() {
  const now = getBeijingDate();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNowDateOnly() {
  return formatDateOnly(getBeijingDate());
}

function normalizePlanNodes(nodes) {
  if (!Array.isArray(nodes)) return [];

  return nodes
    .map((node, index) => ({
      title: String(node?.title ?? "").trim(),
      node_date: String(node?.node_date ?? "").trim(),
      progress_value: Number(node?.progress_value ?? 0),
      importance_delta: Number(node?.importance_delta ?? 0),
      note: String(node?.note ?? "").trim(),
      sort_order: Number(node?.sort_order ?? index)
    }))
    .filter((node) => node.title && node.node_date)
    .map((node, index) => ({
      ...node,
      progress_value: Number.isFinite(node.progress_value) ? Math.min(100, Math.max(0, Math.round(node.progress_value))) : 0,
      importance_delta: Number.isFinite(node.importance_delta) ? Math.min(5, Math.max(-5, Math.round(node.importance_delta))) : 0,
      sort_order: index
    }));
}

function syncPlanNodes(planId, nodes) {
  const normalizedNodes = normalizePlanNodes(nodes);
  db.prepare("DELETE FROM lepid_eye_plan_nodes WHERE plan_id = ?").run(planId);

  if (!normalizedNodes.length) return;

  const insertNode = db.prepare(`
    INSERT INTO lepid_eye_plan_nodes (
      plan_id,
      title,
      node_date,
      progress_value,
      importance_delta,
      note,
      sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  normalizedNodes.forEach((node) => {
    insertNode.run(
      planId,
      node.title,
      node.node_date,
      node.progress_value,
      node.importance_delta,
      node.note,
      node.sort_order
    );
  });
}

function hashAccessToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeAccessRole(role) {
  if (typeof role !== "string") return "low";
  return ACCESS_LEVELS.has(role) ? role : "low";
}

function ensureAdminAccessToken() {
  const adminTokenHash = process.env.LEPID_EYE_ADMIN_TOKEN_HASH ?? "";
  const adminViewerName = process.env.LEPID_EYE_ADMIN_VIEWER_NAME ?? "";
  if (!adminTokenHash || !adminViewerName) return;

  const adminNote = "Initial creator token";
  const existingAdmin = db
    .prepare("SELECT token_hash FROM lepid_eye_access_tokens WHERE token_hash = ?")
    .get(adminTokenHash);

  if (existingAdmin) return;

  db.prepare(`
    INSERT INTO lepid_eye_access_tokens (
      token_hash,
      viewer_name,
      role,
      enabled,
      note
    ) VALUES (?, ?, ?, 1, ?)
  `).run(
    adminTokenHash,
    adminViewerName,
    "creator",
    adminNote
  );
}

function buildSeedData() {
  return { events: [], plans: [] };
}

function initLepidEyeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lepid_eye_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      major_category TEXT NOT NULL,
      minor_category TEXT NOT NULL,
      task_name TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      repeat_type TEXT NOT NULL DEFAULT 'none',
      repeat_until TEXT,
      nature TEXT NOT NULL,
      permission_level INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lepid_eye_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      major_category TEXT NOT NULL,
      minor_category TEXT NOT NULL,
      task_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      expected_due_date TEXT,
      completed_at TEXT,
      permission_level INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lepid_eye_plan_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      node_date TEXT NOT NULL,
      progress_value INTEGER NOT NULL DEFAULT 0,
      importance_delta INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(plan_id) REFERENCES lepid_eye_plans(id)
    );

    CREATE TABLE IF NOT EXISTS lepid_eye_access_tokens (
      token_hash TEXT PRIMARY KEY,
      viewer_name TEXT NOT NULL,
      role TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      note TEXT DEFAULT ''
    );
  `);

  db.exec("DROP TABLE IF EXISTS lepid_eye_plan_logs");

  ensureColumn("lepid_eye_events", "color", "TEXT DEFAULT ''");
  ensureColumn("lepid_eye_plans", "color", "TEXT DEFAULT ''");
  ensureColumn("lepid_eye_plans", "completed_at", "TEXT");
  ensureColumn("lepid_eye_access_tokens", "note", "TEXT DEFAULT ''");

  ensureAdminAccessToken();

  db.prepare(
    `
      UPDATE lepid_eye_events
      SET color = CASE nature
        WHEN 'core' THEN ?
        WHEN 'support' THEN ?
        ELSE ?
      END
      WHERE color IS NULL OR color = ''
    `
  ).run(
    EVENT_COLOR_FALLBACKS.core,
    EVENT_COLOR_FALLBACKS.support,
    EVENT_COLOR_FALLBACKS.non_core
  );

  db.prepare(
    `
      UPDATE lepid_eye_plans
      SET color = CASE status
        WHEN 'primary' THEN ?
        WHEN 'active' THEN ?
        WHEN 'inactive' THEN ?
        ELSE ?
      END
      WHERE color IS NULL OR color = ''
    `
  ).run(
    PLAN_COLOR_FALLBACKS.primary,
    PLAN_COLOR_FALLBACKS.active,
    PLAN_COLOR_FALLBACKS.inactive,
    PLAN_COLOR_FALLBACKS.done
  );

  db.prepare(
    `
      UPDATE lepid_eye_plans
      SET completed_at = COALESCE(completed_at, expected_due_date, start_date)
      WHERE status = 'done' AND (completed_at IS NULL OR completed_at = '')
    `
  ).run();

  const eventCount = db.prepare("SELECT COUNT(*) AS count FROM lepid_eye_events").get().count;
  const planCount = db.prepare("SELECT COUNT(*) AS count FROM lepid_eye_plans").get().count;

  if (eventCount > 0 || planCount > 0) {
    return;
  }

  const { events, plans } = buildSeedData();
  const insertEvent = db.prepare(`
    INSERT INTO lepid_eye_events (
      major_category,
      minor_category,
      task_name,
      start_at,
      end_at,
      repeat_type,
      repeat_until,
      nature,
      permission_level,
      color,
      note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlan = db.prepare(`
    INSERT INTO lepid_eye_plans (
      major_category,
      minor_category,
      task_name,
      start_date,
      status,
      progress,
      expected_due_date,
      completed_at,
      permission_level,
      color,
      note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    events.forEach((event) => {
      insertEvent.run(
        event.major_category,
        event.minor_category,
        event.task_name,
        event.start_at,
        event.end_at,
        event.repeat_type,
        event.repeat_until,
        event.nature,
        event.permission_level,
        event.color,
        event.note
      );
    });

    plans.forEach((plan) => {
      insertPlan.run(
        plan.major_category,
        plan.minor_category,
        plan.task_name,
        plan.start_date,
        plan.status,
        plan.progress,
        plan.expected_due_date,
        plan.completed_at ?? null,
        plan.permission_level,
        plan.color,
        plan.note
      );
    });
  });

  tx();
}

function addMonths(date, offset) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  return next;
}

function ensureColumn(tableName, columnName, columnDef) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

function resolveLepidEyeAccess(requestKey) {
  initLepidEyeDatabase();

  if (typeof requestKey !== "string" || requestKey === "") {
    return {
      accessLevel: "low",
      viewerName: "",
      role: "low",
      editorKey: ""
    };
  }

  const tokenHash = hashAccessToken(requestKey);
  const tokenRecord = db
    .prepare(`
      SELECT viewer_name, role
      FROM lepid_eye_access_tokens
      WHERE token_hash = ? AND enabled = 1
      LIMIT 1
    `)
    .get(tokenHash);

  if (!tokenRecord) {
    return {
      accessLevel: "low",
      viewerName: "",
      role: "low",
      editorKey: ""
    };
  }

  const role = normalizeAccessRole(tokenRecord.role);
  return {
    accessLevel: role,
    viewerName: tokenRecord.viewer_name,
    role,
    editorKey: role === "creator" ? requestKey : ""
  };
}

function verifyLepidEyeCreatorToken(requestKey) {
  return resolveLepidEyeAccess(requestKey).role === "creator";
}

function expandEventOccurrences(events, rangeStart, rangeEnd) {
  const occurrences = [];

  events.forEach((event) => {
    const startAt = new Date(event.start_at.replace(" ", "T"));
    const endAt = new Date(event.end_at.replace(" ", "T"));
    const durationMs = Math.max(0, endAt.getTime() - startAt.getTime());
    const repeatUntil = event.repeat_until ? new Date(`${event.repeat_until}T23:59:59`) : null;

    const pushOccurrence = (occStart) => {
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (occEnd < rangeStart || occStart > rangeEnd) return;
      occurrences.push({
        ...event,
        occurrence_start: formatDateTimeLocal(occStart),
        occurrence_end: formatDateTimeLocal(occEnd)
      });
    };

    if (event.repeat_type === "none") {
      pushOccurrence(startAt);
      return;
    }

    let cursor = new Date(startAt);
    const safeEnd = repeatUntil ?? rangeEnd;

    while (cursor <= safeEnd && cursor <= rangeEnd) {
      pushOccurrence(cursor);

      if (event.repeat_type === "daily") {
        cursor = addDays(cursor, 1);
      } else if (event.repeat_type === "weekly") {
        cursor = addDays(cursor, 7);
      } else if (event.repeat_type === "monthly") {
        cursor = addMonths(cursor, 1);
      } else {
        break;
      }
    }
  });

  return occurrences.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start));
}

function buildStats(events, plans) {
  const periodEnd = getBeijingSliceEnd();
  const periodStart = addDays(periodEnd, -7);
  const visibleEvents = expandEventOccurrences(events, periodStart, periodEnd);
  const categoryTotals = new Map();
  const clippedEvents = visibleEvents
    .map((event) => {
      const start = new Date(event.occurrence_start.replace(" ", "T"));
      const end = new Date(event.occurrence_end.replace(" ", "T"));
      return {
        ...event,
        clippedStart: new Date(Math.max(start.getTime(), periodStart.getTime())),
        clippedEnd: new Date(Math.min(end.getTime(), periodEnd.getTime()))
      };
    })
    .filter((event) => event.clippedEnd > event.clippedStart);

  const timePoints = [
    periodStart.getTime(),
    periodEnd.getTime(),
    ...clippedEvents.flatMap((event) => [event.clippedStart.getTime(), event.clippedEnd.getTime()])
  ].sort((a, b) => a - b);

  for (let index = 0; index < timePoints.length - 1; index += 1) {
    const sliceStart = timePoints[index];
    const sliceEnd = timePoints[index + 1];
    if (sliceEnd <= sliceStart) continue;

    const activeEvents = clippedEvents.filter(
      (event) => event.clippedStart.getTime() <= sliceStart && event.clippedEnd.getTime() >= sliceEnd
    );
    if (!activeEvents.length) continue;

    const sliceDurationHours = (sliceEnd - sliceStart) / 3600000;
    const sharedDurationHours = sliceDurationHours / activeEvents.length;

    activeEvents.forEach((event) => {
      categoryTotals.set(
        event.major_category,
        (categoryTotals.get(event.major_category) ?? 0) + sharedDurationHours
      );
    });
  }

  const sorted = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalHours = 7 * 24;
  const rawSegments = sorted.map(([label, hours], index) => {
    const palette = PIE_PALETTE[index % PIE_PALETTE.length];
    return {
      label,
      value: (hours / totalHours) * 100,
      ...palette
    };
  });

  const pieSegments = rawSegments.map((segment) => ({
    ...segment,
    value: Math.max(1, Math.round(segment.value))
  }));

  const roundedTotal = pieSegments.reduce((sum, segment) => sum + segment.value, 0);
  if (roundedTotal > 100 && pieSegments.length) {
    let overflow = roundedTotal - 100;
    for (let index = pieSegments.length - 1; index >= 0 && overflow > 0; index -= 1) {
      const reducible = Math.max(0, pieSegments[index].value - 1);
      const delta = Math.min(reducible, overflow);
      pieSegments[index].value -= delta;
      overflow -= delta;
    }
  }

  const remaining = Math.max(0, 100 - pieSegments.reduce((sum, segment) => sum + segment.value, 0));
  pieSegments.push({
    label: "空白",
    value: remaining,
    color: "rgba(255,255,255,0.24)",
    topStart: "#8c939d",
    topEnd: "#5f6670",
    sideStart: "#666c76",
    sideEnd: "#353b45"
  });

  const started = plans.filter((plan) => new Date(plan.start_date) <= periodEnd).length;
  const completed = plans.filter((plan) => plan.status === "done").length;
  const remainingPlans = plans.filter((plan) => plan.status !== "done").length;

  return {
    pieSegments,
    planStats: {
      started,
      completed,
      remaining: remainingPlans
    }
  };
}

function sanitizeEventForStats(event, includePrivate) {
  if (includePrivate === "creator") return event;

  if (includePrivate === "high") {
    if (event.permission_level <= 2) return event;
    return {
      ...event,
      task_name: "??"
    };
  }

  if (includePrivate === "medium") {
    if (event.permission_level <= 1) return event;
    if (event.permission_level === 2) {
      return {
        ...event,
        task_name: "??"
      };
    }
    return {
      ...event,
      minor_category: "??",
      task_name: maskMinor(event.major_category)
    };
  }

  if (event.permission_level === 3) {
    return {
      ...event,
      major_category: "秘密事务",
      minor_category: "受限内容",
      task_name: "秘密事务"
    };
  }
  if (event.permission_level === 2) {
    return {
      ...event,
      minor_category: "??",
      task_name: maskMinor(event.major_category)
    };
  }
  if (event.permission_level === 1) {
    return {
      ...event,
      task_name: "??"
    };
  }
  return event;
}

function sanitizePlanForStats(plan, includePrivate) {
  if (includePrivate === "creator") return plan;

  if (includePrivate === "high") {
    if (plan.permission_level <= 2) return plan;
    return {
      ...plan,
      task_name: "??"
    };
  }

  if (includePrivate === "medium") {
    if (plan.permission_level <= 1) return plan;
    if (plan.permission_level === 2) {
      return {
        ...plan,
        task_name: "??"
      };
    }
    return {
      ...plan,
      minor_category: "??",
      task_name: maskMinor(plan.major_category)
    };
  }

  if (plan.permission_level === 3) {
    return {
      ...plan,
      major_category: "秘密计划",
      minor_category: "受限内容",
      task_name: "秘密计划"
    };
  }
  if (plan.permission_level === 2) {
    return {
      ...plan,
      minor_category: "??",
      task_name: maskMinor(plan.major_category)
    };
  }
  if (plan.permission_level === 1) {
    return {
      ...plan,
      task_name: "??"
    };
  }
  return plan;
}

function getLepidEyeBootstrap({ accessLevel = "low" }) {
  initLepidEyeDatabase();

  const events = db.prepare("SELECT * FROM lepid_eye_events ORDER BY start_at ASC").all();
  const plans = db.prepare("SELECT * FROM lepid_eye_plans ORDER BY start_date ASC").all();
  const planNodes = db.prepare("SELECT * FROM lepid_eye_plan_nodes ORDER BY plan_id ASC, sort_order ASC, node_date ASC, id ASC").all();

  const statsEvents = events.map((event) => sanitizeEventForStats(event, accessLevel)).filter(Boolean);
  const statsPlans = plans.map((plan) => sanitizePlanForStats(plan, accessLevel)).filter(Boolean);

  return {
    accessLevel,
    events,
    plans,
    planNodes,
    stats: buildStats(statsEvents, statsPlans),
    aiStatus: "暂未上线"
  };
}

function addLepidEyeRecord({ entity, payload }) {
  initLepidEyeDatabase();

  if (entity === "event") {
    const statement = db.prepare(`
      INSERT INTO lepid_eye_events (
        major_category,
        minor_category,
        task_name,
        start_at,
        end_at,
        repeat_type,
        repeat_until,
        nature,
        permission_level,
        color,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      payload.major_category,
      payload.minor_category,
      payload.task_name,
      payload.start_at,
      payload.end_at,
      payload.repeat_type ?? "none",
      payload.repeat_until ?? null,
      payload.nature,
      Number(payload.permission_level ?? 0),
      payload.color ?? "",
      payload.note ?? ""
    );

    return { entity, id: Number(result.lastInsertRowid) };
  }

  if (entity === "plan") {
    const completedAt =
      payload.status === "done" ? payload.completed_at ?? getNowDateOnly() : null;

    const insertPlan = db.prepare(`
      INSERT INTO lepid_eye_plans (
        major_category,
        minor_category,
        task_name,
        start_date,
        status,
        progress,
        expected_due_date,
        completed_at,
        permission_level,
        color,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      const result = insertPlan.run(
        payload.major_category,
        payload.minor_category,
        payload.task_name,
        payload.start_date,
        payload.status,
        Number(payload.progress ?? 0),
        payload.expected_due_date ?? null,
        completedAt,
        Number(payload.permission_level ?? 0),
        payload.color ?? "",
        payload.note ?? ""
      );

      const planId = Number(result.lastInsertRowid);
      syncPlanNodes(planId, payload.nodes ?? []);

      return { entity, id: planId };
    });

    return tx();
  }

  throw new Error("Unsupported entity");
}

function mutateLepidEyeRecord({ entity, action, id, payload }) {
  initLepidEyeDatabase();

  if (action === "delete") {
    if (entity === "event") {
      db.prepare("DELETE FROM lepid_eye_events WHERE id = ?").run(id);
      return { entity, id, action };
    }

    if (entity === "plan") {
      const tx = db.transaction(() => {
        db.prepare("DELETE FROM lepid_eye_plan_nodes WHERE plan_id = ?").run(id);
        db.prepare("DELETE FROM lepid_eye_plans WHERE id = ?").run(id);
      });
      tx();
      return { entity, id, action };
    }
  }

  if (action === "update") {
    if (entity === "event") {
      const current = db.prepare("SELECT * FROM lepid_eye_events WHERE id = ?").get(id);
      if (!current) throw new Error("Event not found");

      db.prepare(`
        UPDATE lepid_eye_events
        SET major_category = ?, minor_category = ?, task_name = ?, start_at = ?, end_at = ?,
            repeat_type = ?, repeat_until = ?, nature = ?, permission_level = ?, color = ?, note = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        payload.major_category ?? current.major_category,
        payload.minor_category ?? current.minor_category,
        payload.task_name ?? current.task_name,
        payload.start_at ?? current.start_at,
        payload.end_at ?? current.end_at,
        payload.repeat_type ?? current.repeat_type,
        payload.repeat_until ?? current.repeat_until,
        payload.nature ?? current.nature,
        Number(payload.permission_level ?? current.permission_level),
        payload.color ?? current.color,
        payload.note ?? current.note,
        id
      );

      return { entity, id, action };
    }

    if (entity === "plan") {
      const current = db.prepare("SELECT * FROM lepid_eye_plans WHERE id = ?").get(id);
      if (!current) throw new Error("Plan not found");

      const nextStatus = payload.status ?? current.status;
      const nextProgress = Number(payload.progress ?? current.progress);
      const completedAt =
        nextStatus === "done"
          ? payload.completed_at ?? current.completed_at ?? getNowDateOnly()
          : null;

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE lepid_eye_plans
          SET major_category = ?, minor_category = ?, task_name = ?, start_date = ?, status = ?,
              progress = ?, expected_due_date = ?, completed_at = ?, permission_level = ?, color = ?, note = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          payload.major_category ?? current.major_category,
          payload.minor_category ?? current.minor_category,
          payload.task_name ?? current.task_name,
          payload.start_date ?? current.start_date,
          nextStatus,
          nextProgress,
          payload.expected_due_date ?? current.expected_due_date,
          completedAt,
          Number(payload.permission_level ?? current.permission_level),
          payload.color ?? current.color,
          payload.note ?? current.note,
          id
        );

        syncPlanNodes(id, payload.nodes ?? []);
      });

      tx();
      return { entity, id, action };
    }
  }

  throw new Error("Unsupported mutation");
}

module.exports = {
  initLepidEyeDatabase,
  resolveLepidEyeAccess,
  verifyLepidEyeCreatorToken,
  getLepidEyeBootstrap,
  addLepidEyeRecord,
  mutateLepidEyeRecord
};
