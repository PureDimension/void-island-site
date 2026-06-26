"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReturnMenus from "@/components/ReturnMenus";
import PieDonutCard from "./PieDonutCard";
import { useTheme } from "@/lib/theme";

const timelinePastDays = 10;
const timelineFutureDays = 14;
const timelineHourLabelWidth = 78;
const timelineDayWidth = 88;
const timelineRowHeight = 34;
const planPastDays = 14;
const planFutureDays = 14;
const planLabelWidth = 176;
const planScaleMap = {
  day: { label: "日", width: 52 },
  week: { label: "周", width: 78 },
  month: { label: "月", width: 92 },
  year: { label: "年", width: 110 }
};
const statsRangeOptions = [
  { value: 1, label: "天" },
  { value: 7, label: "周" },
  { value: 15, label: "半月" },
  { value: 30, label: "月" }
];
const piePalette = [
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

const NEW_OPTION = "__new__";
const EVENT_REPEAT_OPTIONS = [
  { value: "none", label: "不重复" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" }
];
const EVENT_NATURE_OPTIONS = [
  { value: "support", label: "支持事务" },
  { value: "non_core", label: "非核心事务" },
  { value: "core", label: "核心事务" }
];
const PLAN_STATUS_OPTIONS = [
  { value: "primary", label: "主要推进" },
  { value: "active", label: "活跃" },
  { value: "inactive", label: "非活跃" },
  { value: "done", label: "已完成" }
];
const PERMISSION_LEVEL_OPTIONS = [
  { value: "0", label: "0 级 / 完全公开" },
  { value: "1", label: "1 级 / 名称隐藏" },
  { value: "2", label: "2 级 / 小类隐藏" },
  { value: "3", label: "3 级 / 大类隐藏" }
];
function createPlanNodeDraft(overrides = {}) {
  return {
    clientId: overrides.clientId ?? `node-${Math.random().toString(36).slice(2, 10)}`,
    id: overrides.id ?? null,
    title: overrides.title ?? "",
    nodeDate: overrides.nodeDate ?? "",
    progressValue: overrides.progressValue ?? "0",
    status: overrides.status ?? "active",
    note: overrides.note ?? ""
  };
}

function normalizePlanNodeDrafts(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) =>
    createPlanNodeDraft({
      clientId: node.clientId,
      id: node.id ?? null,
      title: node.title ?? "",
      nodeDate: node.nodeDate ?? node.node_date ?? "",
      progressValue: String(node.progressValue ?? node.progress_value ?? "0"),
      status: node.status ?? "active",
      note: node.note ?? ""
    })
  );
}

function maskMinor(major) {
  return `${major} / ??`;
}

function getBeijingNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function addDays(baseDate, offset) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + offset);
  return next;
}

function formatDateLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function parseLocalDateTime(value) {
  return new Date(value.replace(" ", "T"));
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 24, 0, 0, 0);
}

function getMinuteInDay(date, treatMidnightAsDayEnd = false) {
  const minute = date.getHours() * 60 + date.getMinutes();
  if (treatMidnightAsDayEnd && minute === 0) return 24 * 60;
  return minute;
}

function diffInDays(fromDate, toDate) {
  return Math.round((startOfLocalDay(fromDate).getTime() - startOfLocalDay(toDate).getTime()) / 86400000);
}

function addMonths(date, offset) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  return next;
}

function startOfWeek(date) {
  const next = startOfLocalDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function getPlanPeriodStart(date, scale) {
  if (scale === "day") return startOfLocalDay(date);
  if (scale === "week") return startOfWeek(date);
  if (scale === "month") return startOfMonth(date);
  return startOfYear(date);
}

function addPlanPeriods(date, scale, offset) {
  if (scale === "day") return addDays(date, offset);
  if (scale === "week") return addDays(date, offset * 7);
  if (scale === "month") return addMonths(date, offset);
  return new Date(date.getFullYear() + offset, 0, 1, 0, 0, 0, 0);
}

function getPlanPeriodLabel(startDate, scale) {
  if (scale === "day") return formatDateLabel(startDate);
  if (scale === "week") {
    const thursday = addDays(startDate, 3);
    return formatDateLabel(thursday);
  }
  if (scale === "month") return `${String(startDate.getMonth() + 1).padStart(2, "0")}月`;
  return `${startDate.getFullYear()}`;
}

function findPlanAxisIndex(date, axis) {
  const time = startOfLocalDay(date).getTime();
  for (let index = 0; index < axis.length; index += 1) {
    const period = axis[index];
    if (time >= period.startDate.getTime() && time < period.endDate.getTime()) {
      return index;
    }
  }
  return -1;
}

function getPlanAxisPosition(date, axis, unitWidth) {
  const centeredDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const time = centeredDate.getTime();
  if (!axis.length) return 0;

  const firstStart = axis[0].startDate.getTime();
  const lastEnd = axis.at(-1).endDate.getTime();
  if (time <= firstStart) return 0;
  if (time >= lastEnd) return axis.length * unitWidth;

  for (let index = 0; index < axis.length; index += 1) {
    const period = axis[index];
    const periodStart = period.startDate.getTime();
    const periodEnd = period.endDate.getTime();
    if (time >= periodStart && time < periodEnd) {
      const fraction = (time - periodStart) / Math.max(1, periodEnd - periodStart);
      return index * unitWidth + fraction * unitWidth;
    }
  }

  return axis.length * unitWidth;
}

function mapEventTone(nature) {
  if (nature === "core") return "focus";
  if (nature === "support") return "normal";
  return "mix";
}

function mapPlanState(status) {
  if (status === "primary") return "primary";
  if (status === "active") return "active";
  if (status === "inactive") return "inactive";
  return "done";
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function repeatTypeLabel(repeatType) {
  if (repeatType === "daily") return "每天";
  if (repeatType === "weekly") return "每周";
  if (repeatType === "monthly") return "每月";
  return "不重复";
}

function statusLabel(status) {
  if (status === "primary") return "主要推进";
  if (status === "active") return "活跃";
  if (status === "inactive") return "非活跃";
  return "已完成";
}

function buildRecentEventTaskPresets(events, majorCategory, minorCategory, nowTime) {
  if (!majorCategory || !minorCategory) return [];

  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const byTaskName = new Map();

  events.forEach((event) => {
    if (event.major_category !== majorCategory || event.minor_category !== minorCategory) return;

    const startTime = parseLocalDateTime(event.start_at).getTime();
    if (Math.abs(startTime - nowTime) > windowMs) return;

    const current = byTaskName.get(event.task_name);
    if (!current || startTime > current.startTime) {
      byTaskName.set(event.task_name, {
        taskName: event.task_name,
        startTime,
        repeatType: event.repeat_type,
        repeatUntil: event.repeat_until ?? "",
        nature: event.nature,
        permissionLevel: String(event.permission_level ?? 0),
        color: rgbStringToHex(event.color),
        note: event.note ?? ""
      });
    }
  });

  return [...byTaskName.values()].sort((left, right) => right.startTime - left.startTime);
}

function buildPlanTrackSegments(plan, displayEndDate) {
  const sortedNodes = [...(plan.nodes ?? [])]
    .map((node) => ({
      ...node,
      nodeDate: parseLocalDate(node.node_date ?? node.nodeDate),
      progressValue: clampProgress(node.progress_value ?? node.progressValue ?? 0),
      status: node.status ?? "active"
    }))
    .sort((left, right) => left.nodeDate.getTime() - right.nodeDate.getTime());

  const segmentStates = [];
  const initialStatus = sortedNodes[0]?.status ?? "active";
  const initialProgress = sortedNodes[0]?.progressValue ?? 0;
  segmentStates.push({
    startDate: parseLocalDate(plan.start_date),
    status: initialStatus,
    progress: initialProgress,
    note: plan.note ?? ""
  });

  sortedNodes.forEach((node) => {
    segmentStates.push({
      startDate: node.nodeDate,
      status: node.status,
      progress: node.progressValue,
      note: node.note ?? ""
    });
  });

  const uniqueStates = segmentStates.reduce((accumulator, state) => {
    const lastState = accumulator[accumulator.length - 1];
    if (lastState && lastState.startDate.getTime() === state.startDate.getTime()) {
      accumulator[accumulator.length - 1] = state;
      return accumulator;
    }
    accumulator.push(state);
    return accumulator;
  }, []);

  return uniqueStates
    .map((state, index) => {
      const nextState = uniqueStates[index + 1];
      const endDate = nextState ? nextState.startDate : displayEndDate;
      if (endDate.getTime() <= state.startDate.getTime()) return null;
      return {
        ...state,
        endDate
      };
    })
    .filter(Boolean);
}

function getLatestPlanNode(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return null;
  return [...nodes]
    .map((node, index) => ({
      ...node,
      nodeDate: node.nodeDate ?? node.node_date ?? "",
      sortOrder: Number(node.sortOrder ?? node.sort_order ?? index)
    }))
    .sort((left, right) => {
      const dateDiff = String(left.nodeDate).localeCompare(String(right.nodeDate));
      if (dateDiff !== 0) return dateDiff;
      return left.sortOrder - right.sortOrder;
    })
    .at(-1) ?? null;
}

function buildPlanSnapshot(plan, nodes) {
  const latestNode = getLatestPlanNode(nodes);
  const currentStatus = latestNode?.status ?? "active";
  const currentProgress = clampProgress(latestNode?.progressValue ?? latestNode?.progress_value ?? 0);
  const completedAt = currentStatus === "done" ? plan.completed_at ?? latestNode?.nodeDate ?? latestNode?.node_date ?? null : null;

  return {
    latestNode,
    currentStatus,
    currentProgress,
    completedAt
  };
}

function buildPlanSegmentFill(color, progress, status) {
  const clampedProgress = clampProgress(progress);
  if (status === "inactive") return "transparent";

  const baseWhite = status === "active" ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.88)";
  const tintStrength = status === "active" ? clampedProgress * 0.72 : clampedProgress;
  const whiteStrength = Math.max(0, 100 - tintStrength);

  return `color-mix(in srgb, ${color} ${tintStrength}%, ${baseWhite} ${whiteStrength}%)`;
}

function getTaskDurationMinutes(task) {
  return Math.max(1, task.endMinuteInDay - task.startMinuteInDay);
}

function getTaskFontSize(label, heightPx) {
  return Math.max(
    6,
    Math.min(11, heightPx * 0.42, ((timelineDayWidth - 14) / Math.max(label.length, 2)) * 1.85)
  );
}

function isTaskContainedBy(task, otherTask) {
  if (task.id === otherTask.id) return false;
  return (
    otherTask.startMinuteInDay <= task.startMinuteInDay &&
    otherTask.endMinuteInDay >= task.endMinuteInDay &&
    getTaskDurationMinutes(otherTask) > getTaskDurationMinutes(task)
  );
}

function findTaskContainer(task, taskGroup) {
  const candidates = taskGroup.filter((otherTask) => isTaskContainedBy(task, otherTask));
  if (!candidates.length) return null;
  return candidates.sort((left, right) => getTaskDurationMinutes(left) - getTaskDurationMinutes(right))[0];
}

function buildTimelineOverlapMarkers(taskGroup) {
  const points = [0, 24 * 60];

  taskGroup.forEach((task) => {
    const overlapStart = Math.max(task.startMinuteInDay, 0);
    const overlapEnd = Math.min(task.endMinuteInDay, 24 * 60);
    if (overlapEnd > overlapStart) {
      points.push(overlapStart, overlapEnd);
    }
  });

  const sortedPoints = [...new Set(points)].sort((a, b) => a - b);

  return sortedPoints
    .map((point, index) => {
      const nextPoint = sortedPoints[index + 1];
      if (nextPoint == null || nextPoint <= point) return null;
      const activeTasks = taskGroup.filter(
        (task) => task.startMinuteInDay < nextPoint && task.endMinuteInDay > point
      );
      if (activeTasks.length < 2) return null;

      const hasContainment = activeTasks.some((task) => activeTasks.some((otherTask) => isTaskContainedBy(task, otherTask)));
      if (hasContainment) return null;

      return {
        key: `${point}-${nextPoint}`,
        topPx: (point / 60) * timelineRowHeight,
        heightPx: Math.max(4, ((nextPoint - point) / 60) * timelineRowHeight),
        tasks: activeTasks,
        background: `repeating-linear-gradient(135deg, ${activeTasks
          .map((item, markerIndex) => `${item.color} ${markerIndex * 10}px ${(markerIndex + 1) * 10}px`)
          .join(", ")})`
      };
    })
    .filter(Boolean);
}

function buildTimelineEventCards(taskGroup) {
  const sortedTasks = [...taskGroup].sort((left, right) => {
    const startDiff = left.startMinuteInDay - right.startMinuteInDay;
    if (startDiff !== 0) return startDiff;
    return getTaskDurationMinutes(right) - getTaskDurationMinutes(left);
  });

  return sortedTasks.map((task) => {
    const container = findTaskContainer(task, sortedTasks);
    const isFutureSegment = task.dayOffset > 0;
    let eventOpacity = 0.52;
    if (task.nature === "core") eventOpacity = 1;
    if (task.nature === "non_core") eventOpacity = 0.74;
    if (task.nature === "support") eventOpacity = 0.46;
    if (isFutureSegment) eventOpacity *= 0.66;

    const heightPx = Math.max(6, ((task.endMinuteInDay - task.startMinuteInDay) / 60) * timelineRowHeight);
    const fontSize = getTaskFontSize(task.label, heightPx);

    return {
      ...task,
      containerId: container?.id ?? null,
      isNested: Boolean(container),
      topPx: (task.startMinuteInDay / 60) * timelineRowHeight,
      heightPx,
      fontSize,
      eventOpacity,
      zIndex: container ? 7 : 4
    };
  });
}

function expandEventOccurrencesForStats(events, rangeStart, rangeEnd) {
  const occurrences = [];

  events.forEach((event) => {
    const startAt = parseLocalDateTime(event.start_at);
    const endAt = parseLocalDateTime(event.end_at);
    const durationMs = Math.max(0, endAt.getTime() - startAt.getTime());
    const repeatUntil = event.repeat_until ? new Date(`${event.repeat_until}T23:59:59`) : null;

    const pushOccurrence = (occurrenceStart) => {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (occurrenceEnd <= rangeStart || occurrenceStart >= rangeEnd) return;
      occurrences.push({
        ...event,
        clippedStart: new Date(Math.max(occurrenceStart.getTime(), rangeStart.getTime())),
        clippedEnd: new Date(Math.min(occurrenceEnd.getTime(), rangeEnd.getTime())),
        durationMs
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

  return occurrences.filter((event) => event.clippedEnd > event.clippedStart);
}

function buildStatsForRange(events, plans, rangeDays, now) {
  const periodEnd = new Date(now);
  const periodStart = new Date(periodEnd.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const visibleEvents = expandEventOccurrencesForStats(events, periodStart, periodEnd);
  const categoryTotals = new Map();
  const timePoints = [
    periodStart.getTime(),
    periodEnd.getTime(),
    ...visibleEvents.flatMap((event) => [event.clippedStart.getTime(), event.clippedEnd.getTime()])
  ].sort((a, b) => a - b);

  for (let index = 0; index < timePoints.length - 1; index += 1) {
    const sliceStart = timePoints[index];
    const sliceEnd = timePoints[index + 1];
    if (sliceEnd <= sliceStart) continue;

    const activeEvents = visibleEvents.filter(
      (event) => event.clippedStart.getTime() <= sliceStart && event.clippedEnd.getTime() >= sliceEnd
    );
    if (!activeEvents.length) continue;

    const dominantEvents = activeEvents.filter(
      (event) =>
        !activeEvents.some(
          (otherEvent) =>
            otherEvent !== event &&
            event.clippedStart.getTime() <= otherEvent.clippedStart.getTime() &&
            event.clippedEnd.getTime() >= otherEvent.clippedEnd.getTime() &&
            (event.clippedStart.getTime() < otherEvent.clippedStart.getTime() ||
              event.clippedEnd.getTime() > otherEvent.clippedEnd.getTime())
        )
    );

    const effectiveEvents = dominantEvents.length ? dominantEvents : activeEvents;
    const sliceDurationHours = (sliceEnd - sliceStart) / 3600000;
    const sharedDurationHours = sliceDurationHours / effectiveEvents.length;

    effectiveEvents.forEach((event) => {
      const categoryLabel = event.displayMajor ?? event.major_category;
      categoryTotals.set(categoryLabel, (categoryTotals.get(categoryLabel) ?? 0) + sharedDurationHours);
    });
  }

  const totalHours = Math.max(1 / 60, (periodEnd.getTime() - periodStart.getTime()) / 3600000);
  const pieSegments = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, hours], index) => ({
      label,
      value: (hours / totalHours) * 100,
      ...piePalette[index % piePalette.length]
    }))
    .map((segment) => ({
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

  const started = plans.filter((plan) => {
    const startTime = parseLocalDate(plan.start_date).getTime();
    return startTime >= periodStart.getTime() && startTime <= periodEnd.getTime();
  }).length;
  const completed = plans.filter((plan) => {
    if (!plan.completedAt) return false;
    const completedTime = parseLocalDate(plan.completedAt).getTime();
    return completedTime >= periodStart.getTime() && completedTime <= periodEnd.getTime();
  }).length;
  const remainingPlans = plans.filter((plan) => {
    const startTime = parseLocalDate(plan.start_date).getTime();
    return startTime <= periodEnd.getTime() && plan.currentStatus !== "done";
  }).length;

  return {
    pieSegments,
    planStats: {
      started,
      completed,
      remaining: remainingPlans
    }
  };
}

function sanitizeEventForMode(event, mode) {
  if (mode === "creator") {
    return {
      ...event,
      displayMajor: event.major_category,
      displayMinor: event.minor_category,
      displayTaskName: event.task_name,
      displayNote: event.note
    };
  }

  if (mode === "high") {
    if (event.permission_level <= 2) {
      return {
        ...event,
        displayMajor: event.major_category,
        displayMinor: event.minor_category,
        displayTaskName: event.task_name,
        displayNote: event.note
      };
    }
    return {
      ...event,
      displayMajor: event.major_category,
      displayMinor: event.minor_category,
      displayTaskName: "??",
      displayNote: "最高权限下隐藏名称。"
    };
  }

  if (mode === "medium") {
    if (event.permission_level <= 1) {
      return {
        ...event,
        displayMajor: event.major_category,
        displayMinor: event.minor_category,
        displayTaskName: event.task_name,
        displayNote: event.note
      };
    }
    if (event.permission_level === 2) {
      return {
        ...event,
        displayMajor: event.major_category,
        displayMinor: event.minor_category,
        displayTaskName: "??",
        displayNote: "部分权限下隐藏名称。"
      };
    }
    return {
      ...event,
      displayMajor: event.major_category,
      displayMinor: "??",
      displayTaskName: maskMinor(event.major_category),
      displayNote: "部分权限下隐藏小类。"
    };
  }

  if (event.permission_level === 3) {
    return {
      ...event,
      displayMajor: "秘密事务",
      displayMinor: "受限内容",
      displayTaskName: "秘密事务",
      displayNote: "公开权限下隐藏大类。"
    };
  }

  if (event.permission_level === 2) {
    return {
      ...event,
      displayMajor: event.major_category,
      displayMinor: "??",
      displayTaskName: maskMinor(event.major_category),
      displayNote: "公开权限下隐藏小类。"
    };
  }

  if (event.permission_level === 1) {
    return {
      ...event,
      displayMajor: event.major_category,
      displayMinor: event.minor_category,
      displayTaskName: "??",
      displayNote: "公开权限下隐藏名称。"
    };
  }

  return {
    ...event,
    displayMajor: event.major_category,
    displayMinor: event.minor_category,
    displayTaskName: event.task_name,
    displayNote: event.note
  };
}

function sanitizePlanForMode(plan, mode) {
  if (mode === "creator") {
    return {
      ...plan,
      displayMajor: plan.major_category,
      displayMinor: plan.minor_category,
      displayTaskName: plan.task_name,
      displayNote: plan.note
    };
  }

  if (mode === "high") {
    if (plan.permission_level <= 2) {
      return {
        ...plan,
        displayMajor: plan.major_category,
        displayMinor: plan.minor_category,
        displayTaskName: plan.task_name,
        displayNote: plan.note
      };
    }
    return {
      ...plan,
      displayMajor: plan.major_category,
      displayMinor: plan.minor_category,
      displayTaskName: "??",
      displayNote: "最高权限下隐藏名称。"
    };
  }

  if (mode === "medium") {
    if (plan.permission_level <= 1) {
      return {
        ...plan,
        displayMajor: plan.major_category,
        displayMinor: plan.minor_category,
        displayTaskName: plan.task_name,
        displayNote: plan.note
      };
    }
    if (plan.permission_level === 2) {
      return {
        ...plan,
        displayMajor: plan.major_category,
        displayMinor: plan.minor_category,
        displayTaskName: "??",
        displayNote: "部分权限下隐藏名称。"
      };
    }
    return {
      ...plan,
      displayMajor: plan.major_category,
      displayMinor: "??",
      displayTaskName: maskMinor(plan.major_category),
      displayNote: "部分权限下隐藏小类。"
    };
  }

  if (plan.permission_level === 3) {
    return {
      ...plan,
      displayMajor: "秘密计划",
      displayMinor: "受限内容",
      displayTaskName: "秘密计划",
      displayNote: "公开权限下隐藏大类。"
    };
  }

  if (plan.permission_level === 2) {
    return {
      ...plan,
      displayMajor: plan.major_category,
      displayMinor: "??",
      displayTaskName: maskMinor(plan.major_category),
      displayNote: "公开权限下隐藏小类。"
    };
  }

  if (plan.permission_level === 1) {
    return {
      ...plan,
      displayMajor: plan.major_category,
      displayMinor: plan.minor_category,
      displayTaskName: "??",
      displayNote: "公开权限下隐藏名称。"
    };
  }

  return {
    ...plan,
    displayMajor: plan.major_category,
    displayMinor: plan.minor_category,
    displayTaskName: plan.task_name,
    displayNote: plan.note
  };
}

function expandTimelineEvents(events, rangeStart, rangeEnd, timelinePastOffset) {
  const occurrences = [];
  const todayIndex = timelinePastOffset;

  events.forEach((event) => {
    const baseStart = parseLocalDateTime(event.start_at);
    const baseEnd = parseLocalDateTime(event.end_at);
    const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
    const repeatUntil = event.repeat_until ? parseLocalDate(event.repeat_until) : null;
    const startDayIndex = diffInDays(baseStart, rangeStart);
    const endDayIndex = repeatUntil ? diffInDays(repeatUntil, rangeStart) : null;
    const dailyLabelDayIndex =
      event.repeat_type === "daily"
        ? startDayIndex > todayIndex
          ? startDayIndex
          : endDayIndex !== null && endDayIndex < todayIndex
            ? endDayIndex
            : todayIndex
        : null;

    const pushOccurrence = (occurrenceStart) => {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (occurrenceEnd < rangeStart || occurrenceStart > rangeEnd) return;

      let sliceStart = new Date(occurrenceStart);

      while (sliceStart < occurrenceEnd) {
        const sliceDayStart = startOfLocalDay(sliceStart);
        const sliceDayEnd = endOfLocalDay(sliceStart);
        const sliceEnd = new Date(Math.min(occurrenceEnd.getTime(), sliceDayEnd.getTime()));
        const diffDays = Math.round((sliceDayStart.getTime() - rangeStart.getTime()) / 86400000);
        const startMinuteInDay = getMinuteInDay(sliceStart);
        const endMinuteInDay = Math.max(
          startMinuteInDay + 1,
          getMinuteInDay(sliceEnd, sliceEnd.getTime() === sliceDayEnd.getTime())
        );

        occurrences.push({
          id: `${event.id}-${occurrenceStart.toISOString()}-${diffDays}`,
          sourceId: event.id,
          dayIndex: diffDays,
          start: sliceStart.getHours(),
          end: Math.max(sliceStart.getHours() + 1, sliceEnd.getHours()),
          startMinuteInDay,
          endMinuteInDay,
          tone: mapEventTone(event.nature),
          label: event.displayTaskName,
          note: event.displayNote,
          category: `${event.displayMajor} · ${event.displayMinor}`,
          majorCategory: event.displayMajor,
          minorCategory: event.displayMinor,
          color: event.color,
          isRepeating: event.repeat_type !== "none",
          repeatType: event.repeat_type,
          repeatUntil: event.repeat_until,
          showDailyLabel: event.repeat_type === "daily" && diffDays === dailyLabelDayIndex,
          nature: event.nature,
          originalStart: event.start_at,
          originalEnd: event.end_at
        });

        sliceStart = sliceEnd;
      }
    };

    if (event.repeat_type === "none") {
      pushOccurrence(baseStart);
      return;
    }

    let cursor = new Date(baseStart);
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

  return occurrences.filter((item) => item.dayIndex >= 0 && item.dayIndex <= timelinePastOffset + timelineFutureDays);
}

function getAccessLabel(accessLevel) {
  if (accessLevel === "creator") return "管理员";
  if (accessLevel === "high") return "最高";
  if (accessLevel === "medium") return "部分权限";
  return "公开权限";
}

function formatDateTimeField(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDateField(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hexToRgbString(value) {
  const normalized = value.replace("#", "").trim();
  if (normalized.length !== 6) return "rgb(186, 222, 255)";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbStringToHex(value) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length < 3) return "#badeff";
  return `#${numbers
    .slice(0, 3)
    .map((item) => Math.max(0, Math.min(255, item)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function formatDateTimeDisplay(value) {
  if (!value) return "未设置";
  return value.replace("T", " ").replace(/:\d{2}$/u, "");
}

function getEventAnchorTime(event) {
  const start = parseLocalDateTime(event.start_at).getTime();
  const end = parseLocalDateTime(event.end_at).getTime();
  return start + (end - start) / 2;
}

function getPlanAnchorTime(plan) {
  const reference = plan.completed_at ?? plan.expected_due_date ?? plan.start_date;
  return parseLocalDate(reference).getTime();
}

function getSelectorKindOptions(entity) {
  if (entity === "plan") {
    return [
      { value: "keyword", label: "关键词" },
      { value: "major", label: "大类" },
      { value: "status", label: "状态" },
      { value: "permission", label: "权限等级" },
      { value: "date_after", label: "起始晚于" },
      { value: "date_before", label: "起始早于" }
    ];
  }

  return [
    { value: "keyword", label: "关键词" },
    { value: "major", label: "大类" },
    { value: "nature", label: "事务性质" },
    { value: "repeat", label: "重复方式" },
    { value: "permission", label: "权限等级" },
    { value: "date_after", label: "开始晚于" },
    { value: "date_before", label: "开始早于" }
  ];
}

function createSelectorFilter(entity, kind, majors) {
  if (kind === "major") {
    return {
      id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: majors[0] ?? ""
    };
  }

  if (kind === "status") {
    return {
      id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: PLAN_STATUS_OPTIONS[0].value
    };
  }

  if (kind === "nature") {
    return {
      id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: EVENT_NATURE_OPTIONS[0].value
    };
  }

  if (kind === "repeat") {
    return {
      id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: EVENT_REPEAT_OPTIONS[0].value
    };
  }

  if (kind === "permission") {
    return {
      id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: PERMISSION_LEVEL_OPTIONS[0].value
    };
  }

  return {
    id: `${entity}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    value: ""
  };
}

function getEventGroupingLabel(event, now) {
  if (event.repeat_type !== "none") return "重复性事务";
  const start = parseLocalDateTime(event.start_at).getTime();
  const diffDays = Math.abs(start - now.getTime()) / 86400000;
  if (diffDays <= 1) return "近1天内";
  if (diffDays <= 3) return "近3天内";
  if (diffDays <= 7) return "近7天内";
  if (diffDays <= 30) return "近30天内";
  return "其他";
}

function collectCategoryOptions(items) {
  const majorMap = new Map();
  items.forEach((item) => {
    const major = item.major_category;
    const minor = item.minor_category;
    if (!majorMap.has(major)) {
      majorMap.set(major, new Set());
    }
    majorMap.get(major).add(minor);
  });

  return {
    majors: [...majorMap.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    minorMap: new Map(
      [...majorMap.entries()].map(([major, minors]) => [
        major,
        [...minors].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
      ])
    )
  };
}

function getPermissionMatrix(accessLevel) {
  const rows = [
    { level: "0 级", description: "完全公开" },
    { level: "1 级", description: "名称隐藏" },
    { level: "2 级", description: "小类隐藏" },
    { level: "3 级", description: "大类隐藏" }
  ];

  if (accessLevel === "creator") {
    return rows.map((row) => ({ ...row, access: "完全公开，可编辑" }));
  }

  if (accessLevel === "high") {
    return [
      { level: "0 级", access: "完全公开" },
      { level: "1 级", access: "完全公开" },
      { level: "2 级", access: "完全公开" },
      { level: "3 级", access: "名称隐藏" }
    ];
  }

  if (accessLevel === "medium") {
    return [
      { level: "0 级", access: "完全公开" },
      { level: "1 级", access: "完全公开" },
      { level: "2 级", access: "名称隐藏" },
      { level: "3 级", access: "小类隐藏" }
    ];
  }

  return [
    { level: "0 级", access: "完全公开" },
    { level: "1 级", access: "名称隐藏" },
    { level: "2 级", access: "小类隐藏" },
    { level: "3 级", access: "大类隐藏" }
  ];
}

export default function MainProjectPage({ projects, bootstrap, editorKey, viewerName = "" }) {
  const { isDarkMode } = useTheme();
  const descriptionFile = projects.find((file) => file.filename === "description");
  const description = descriptionFile?.content ?? "文档暂未接入。";
  const panelDescription = description.replace(/^# .*\n+/u, "");
  const introLines = panelDescription
    .split(/\n+/u)
    .map((line) => line.replace(/^[-*]\s*/u, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  const accessLevel = bootstrap.accessLevel ?? "low";
  const isCreator = accessLevel === "creator";
  const permissionMatrix = getPermissionMatrix(accessLevel);
  const [beijingNow, setBeijingNow] = useState(() => getBeijingNow());
  const canvasRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const planScrollRef = useRef(null);
  const hoverCloseTimerRef = useRef(null);
  const [planScale, setPlanScale] = useState("day");
  const [statsRangeDays, setStatsRangeDays] = useState(7);
  const [eventCategoryFilter, setEventCategoryFilter] = useState("全部大类");
  const [planCategoryFilter, setPlanCategoryFilter] = useState("全部大类");
  const [showInactivePlanRows, setShowInactivePlanRows] = useState(false);
  const [hoverCard, setHoverCard] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [selectorSort, setSelectorSort] = useState("nearest");
  const [selectorAddKind, setSelectorAddKind] = useState("keyword");
  const [selectorFilters, setSelectorFilters] = useState([]);
  const [selectorOpenGroups, setSelectorOpenGroups] = useState({});
  const [selectorShowInactiveGroups, setSelectorShowInactiveGroups] = useState({});
  const [timelinePanelHeight, setTimelinePanelHeight] = useState(null);
  const docPanelRef = useRef(null);
  const timelinePanelRef = useRef(null);
  const now = new Date();
  const defaultEventStart = formatDateTimeField(new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.max(8, now.getHours()), 0, 0, 0));
  const defaultEventEnd = formatDateTimeField(new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.max(9, now.getHours() + 1), 0, 0, 0));
  const defaultPlanDate = formatDateField(now);
  const [eventDraft, setEventDraft] = useState(() => ({
    majorMode: NEW_OPTION,
    majorSelect: NEW_OPTION,
    majorInput: "",
    minorMode: NEW_OPTION,
    minorSelect: NEW_OPTION,
    minorInput: "",
    taskNameMode: NEW_OPTION,
    taskNameSelect: NEW_OPTION,
    taskNameInput: "",
    startAt: defaultEventStart,
    endAt: defaultEventEnd,
    repeatType: "none",
    repeatUntil: "",
    nature: "non_core",
    permissionLevel: "0",
    color: "#badeff",
    note: ""
  }));
  const [planDraft, setPlanDraft] = useState(() => ({
    majorMode: NEW_OPTION,
    majorSelect: NEW_OPTION,
    majorInput: "",
    minorMode: NEW_OPTION,
    minorSelect: NEW_OPTION,
    minorInput: "",
    taskName: "",
    startDate: defaultPlanDate,
    expectedDueDate: "",
    completedAt: "",
    permissionLevel: "0",
    color: "#badeff",
    note: "",
    nodes: [createPlanNodeDraft({ nodeDate: defaultPlanDate, status: "active", progressValue: "0" })]
  }));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBeijingNow(getBeijingNow());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const docPanel = docPanelRef.current;
    if (!docPanel) return undefined;

    const updateTimelinePanelHeight = () => {
      if (window.innerWidth <= 960) {
        setTimelinePanelHeight(null);
        return;
      }
      setTimelinePanelHeight(docPanel.getBoundingClientRect().height);
    };

    updateTimelinePanelHeight();

    const observer = new ResizeObserver(() => {
      updateTimelinePanelHeight();
    });
    observer.observe(docPanel);
    window.addEventListener("resize", updateTimelinePanelHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTimelinePanelHeight);
    };
  }, [introLines.length, permissionMatrix.length, viewerName, editorKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const butterflies = [];
    const butterflySprite = new window.Image();
    butterflySprite.src = "/butterfly-glow.svg";
    const ambientButterflyCount = 8;
    let animationFrame = null;

    function resizeCanvas() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function createAmbientFlightPlan(slot = 0, slotCount = ambientButterflyCount) {
      const normalizedSlot = slotCount <= 1 ? 0.5 : slot / (slotCount - 1);
      const offscreenPadding = 96;
      const startFromLeft = slot % 2 === 0;
      const endToRight = slot % 3 !== 1;

      const startX = startFromLeft
        ? randomBetween(-offscreenPadding - 72, -offscreenPadding + 24)
        : randomBetween(window.innerWidth * 0.08, window.innerWidth * 0.58);
      const startY = startFromLeft
        ? window.innerHeight * (0.24 + normalizedSlot * 0.42) + randomBetween(-28, 28)
        : randomBetween(window.innerHeight + offscreenPadding - 24, window.innerHeight + offscreenPadding + 96);

      const endX = endToRight
        ? randomBetween(window.innerWidth + offscreenPadding - 24, window.innerWidth + offscreenPadding + 96)
        : randomBetween(window.innerWidth * 0.42, window.innerWidth * 0.92);
      const endY = endToRight
        ? window.innerHeight * (0.14 + normalizedSlot * 0.56) + randomBetween(-34, 34)
        : randomBetween(-offscreenPadding - 72, -offscreenPadding + 24);
      const lift = randomBetween(120, 220);
      const spread = randomBetween(90, 190);

      return {
        startX,
        startY,
        control1X: startFromLeft ? startX + randomBetween(110, 240) : startX + randomBetween(-60, 90),
        control1Y: startFromLeft ? startY - lift : startY - randomBetween(150, 250),
        control2X: endToRight ? endX - randomBetween(180, 340) : endX + randomBetween(-80, 60),
        control2Y: endToRight ? endY + randomBetween(24, spread) : endY + randomBetween(140, 220),
        endX,
        endY,
        spiralAmplitude: randomBetween(8, 18),
        spiralFrequency: randomBetween(5.8, 8.2),
        spiralPhase: Math.random() * Math.PI * 2
      };
    }

    function cubicBezierPoint(plan, t) {
      const inv = 1 - t;
      return {
        x:
          inv ** 3 * plan.startX +
          3 * inv ** 2 * t * plan.control1X +
          3 * inv * t ** 2 * plan.control2X +
          t ** 3 * plan.endX,
        y:
          inv ** 3 * plan.startY +
          3 * inv ** 2 * t * plan.control1Y +
          3 * inv * t ** 2 * plan.control2Y +
          t ** 3 * plan.endY
      };
    }

    function cubicBezierTangent(plan, t) {
      const inv = 1 - t;
      return {
        x:
          3 * inv ** 2 * (plan.control1X - plan.startX) +
          6 * inv * t * (plan.control2X - plan.control1X) +
          3 * t ** 2 * (plan.endX - plan.control2X),
        y:
          3 * inv ** 2 * (plan.control1Y - plan.startY) +
          6 * inv * t * (plan.control2Y - plan.control1Y) +
          3 * t ** 2 * (plan.endY - plan.control2Y)
      };
    }

    function hasNearbyButterfly(x, y, minDistance, ignoreIndex = -1) {
      return butterflies.some((item, index) => {
        if (index === ignoreIndex) return false;
        return Math.hypot(item.x - x, item.y - y) < minDistance;
      });
    }

    function createButterfly(index, options = {}) {
      const ambientSlot = options.ambientSlot ?? (index % ambientButterflyCount);
      let flightPlan = createAmbientFlightPlan(ambientSlot, ambientButterflyCount);
      let baseX = flightPlan.startX;
      let baseY = flightPlan.startY;

      for (let attempt = 0; attempt < 18 && hasNearbyButterfly(baseX, baseY, 150, options.ignoreIndex ?? -1); attempt += 1) {
        flightPlan = createAmbientFlightPlan(ambientSlot, ambientButterflyCount);
        baseX = flightPlan.startX;
        baseY = flightPlan.startY;
      }

      return {
        x: baseX,
        y: baseY,
        vx: 1,
        vy: -1,
        pulse: Math.random() * Math.PI * 2,
        size: 10 + Math.random() * 8,
        flightPlan,
        progress: options.progress ?? Math.min(0.94, ambientSlot / ambientButterflyCount + randomBetween(-0.035, 0.035)),
        progressSpeed: randomBetween(0.0024, 0.0035),
        spriteRotationOffset: Math.PI / 2,
        ambientSlot
      };
    }

    function initButterflies() {
      butterflies.length = 0;
      for (let i = 0; i < ambientButterflyCount; i += 1) {
        butterflies.push(
          createButterfly(i, {
            ambientSlot: i,
            progress: Math.min(0.92, i / ambientButterflyCount + randomBetween(-0.025, 0.025))
          })
        );
      }
    }

    function drawButterfly(butterfly) {
      const fade = 1;
      const pulse = Math.sin(butterfly.pulse) * 0.5 + 0.5;
      const alpha = fade * (0.84 + pulse * 0.14);
      const silhouetteScale = 0.97 + pulse * 0.04;
      ctx.save();
      ctx.translate(butterfly.x, butterfly.y);
      ctx.rotate(Math.atan2(butterfly.vy, butterfly.vx) + butterfly.spriteRotationOffset);
      ctx.globalAlpha = alpha;
      ctx.scale(silhouetteScale, silhouetteScale);

      const spriteReady = butterflySprite.complete && butterflySprite.naturalWidth > 0;
      const width = butterfly.size * 4.8;
      const height = butterfly.size * 4.2;

      if (spriteReady) {
        ctx.save();
        ctx.globalAlpha = alpha * (0.34 + pulse * 0.18);
        ctx.shadowBlur = 26 + pulse * 14;
        ctx.shadowColor = "rgba(255,255,255,0.82)";
        ctx.scale(1.18 + pulse * 0.04, 1.18 + pulse * 0.04);
        ctx.drawImage(butterflySprite, -width / 2, -height / 2, width, height);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = alpha * (0.92 + pulse * 0.08);
        ctx.shadowBlur = 16 + pulse * 8;
        ctx.shadowColor = "rgba(255,255,255,0.55)";
        ctx.drawImage(butterflySprite, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.ellipse(-butterfly.size * 0.7, -butterfly.size * 0.22, butterfly.size * 0.9, butterfly.size * 0.62, -0.72, 0, Math.PI * 2);
        ctx.ellipse(-butterfly.size * 0.6, butterfly.size * 0.52, butterfly.size * 0.6, butterfly.size * 0.44, 0.84, 0, Math.PI * 2);
        ctx.ellipse(butterfly.size * 0.7, -butterfly.size * 0.22, butterfly.size * 0.9, butterfly.size * 0.62, 0.72, 0, Math.PI * 2);
        ctx.ellipse(butterfly.size * 0.6, butterfly.size * 0.52, butterfly.size * 0.6, butterfly.size * 0.44, -0.84, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.fill();
      }

      ctx.restore();
    }

    function tick() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      butterflies.forEach((butterfly, index) => {
        butterfly.phase += 0.026 + index * 0.0008;
        butterfly.pulse += 0.05;
        butterfly.progress += butterfly.progressSpeed;
        const t = Math.min(butterfly.progress, 1);
        const plan = butterfly.flightPlan;
        const point = cubicBezierPoint(plan, t);
        const tangent = cubicBezierTangent(plan, t);
        const tangentLength = Math.max(1, Math.hypot(tangent.x, tangent.y));
        const normalX = -tangent.y / tangentLength;
        const normalY = tangent.x / tangentLength;
        const spiralAmount =
          Math.sin(t * plan.spiralFrequency + plan.spiralPhase) * plan.spiralAmplitude * (1 - t * 0.8);
        const longitudinal = Math.sin(t * (plan.spiralFrequency * 0.42) + plan.spiralPhase) * 4;

        butterfly.x = point.x + normalX * spiralAmount + (tangent.x / tangentLength) * longitudinal;
        butterfly.y = point.y + normalY * spiralAmount * 0.34 + (tangent.y / tangentLength) * longitudinal * 0.12;
        butterfly.vx = tangent.x / 18 + normalX * Math.cos(t * plan.spiralFrequency + plan.spiralPhase) * 0.28;
        butterfly.vy = tangent.y / 18 + normalY * Math.cos(t * plan.spiralFrequency + plan.spiralPhase) * 0.16;

        if (butterfly.progress >= 1.02) {
          Object.assign(
            butterfly,
            createButterfly(index, {
              ignoreIndex: index,
              ambientSlot: butterfly.ambientSlot,
              progress: randomBetween(0, 0.04)
            })
          );
        }

        drawButterfly(butterfly);
      });

      animationFrame = window.requestAnimationFrame(tick);
    }

    function handleResize() {
      resizeCanvas();
      initButterflies();
    }

    resizeCanvas();
    initButterflies();
    tick();
    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDarkMode]);

  const planScaleConfig = planScaleMap[planScale];
  const planColumnCount = planPastDays + planFutureDays + 1;
  const planUnitWidth = planScaleConfig.width;

  const visibleEvents = useMemo(
    () => bootstrap.events.map((event) => sanitizeEventForMode(event, accessLevel)).filter(Boolean),
    [accessLevel, bootstrap.events]
  );

  const planNodesByPlanId = useMemo(() => {
    const grouped = new Map();
    (bootstrap.planNodes ?? []).forEach((node) => {
      const current = grouped.get(node.plan_id) ?? [];
      current.push(node);
      grouped.set(node.plan_id, current);
    });
    return grouped;
  }, [bootstrap.planNodes]);
  const visiblePlans = useMemo(
    () =>
      bootstrap.plans
        .map((plan) => sanitizePlanForMode(plan, accessLevel))
        .filter(Boolean)
        .map((plan) => {
          const nodes = planNodesByPlanId.get(plan.id) ?? [];
          return {
            ...plan,
            nodes,
            ...buildPlanSnapshot(plan, nodes)
          };
        }),
    [accessLevel, bootstrap.plans, planNodesByPlanId]
  );

  const eventCategoryCatalog = useMemo(() => collectCategoryOptions(bootstrap.events), [bootstrap.events]);
  const planCategoryCatalog = useMemo(() => collectCategoryOptions(bootstrap.plans), [bootstrap.plans]);
  const editableEvents = useMemo(
    () =>
      bootstrap.events.map((event) => ({
        ...event,
        anchorTime: getEventAnchorTime(event)
      })),
    [bootstrap.events]
  );
  const editablePlans = useMemo(
    () =>
      bootstrap.plans.map((plan) => {
        const nodes = planNodesByPlanId.get(plan.id) ?? [];
        const snapshot = buildPlanSnapshot(plan, nodes);
        return {
          ...plan,
          nodes,
          ...snapshot,
          anchorTime: getPlanAnchorTime({
            ...plan,
            completed_at: snapshot.completedAt
          })
        };
      }),
    [bootstrap.plans, planNodesByPlanId]
  );

  const eventCategoryOptions = useMemo(
    () => ["全部大类", ...new Set(visibleEvents.map((event) => event.displayMajor))],
    [visibleEvents]
  );

  const planCategoryOptions = useMemo(
    () => ["全部大类", ...new Set(visiblePlans.map((plan) => plan.displayMajor))],
    [visiblePlans]
  );

  const filteredEvents = useMemo(
    () =>
      eventCategoryFilter === "全部大类"
        ? visibleEvents
        : visibleEvents.filter((event) => event.displayMajor === eventCategoryFilter),
    [eventCategoryFilter, visibleEvents]
  );

  const filteredPlans = useMemo(
    () =>
      planCategoryFilter === "全部大类"
        ? visiblePlans
        : visiblePlans.filter((plan) => plan.displayMajor === planCategoryFilter),
    [planCategoryFilter, visiblePlans]
  );

  const statsData = useMemo(() => {
    const nowDate = new Date(
      beijingNow.year,
      beijingNow.month - 1,
      beijingNow.day,
      beijingNow.hour,
      beijingNow.minute,
      0,
      0
    );
    return buildStatsForRange(visibleEvents, visiblePlans, statsRangeDays, nowDate);
  }, [beijingNow.day, beijingNow.hour, beijingNow.minute, beijingNow.month, beijingNow.year, statsRangeDays, visibleEvents, visiblePlans]);

  useEffect(() => {
    if (!eventCategoryOptions.includes(eventCategoryFilter)) {
      setEventCategoryFilter("全部大类");
    }
  }, [eventCategoryFilter, eventCategoryOptions]);

  useEffect(() => {
    if (!planCategoryOptions.includes(planCategoryFilter)) {
      setPlanCategoryFilter("全部大类");
    }
  }, [planCategoryFilter, planCategoryOptions]);

  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;

    const nextLeft = Math.max(
      0,
      timelinePastDays * timelineDayWidth + timelineDayWidth / 2 - container.clientWidth / 2
    );
    const nextTop = Math.max(0, beijingNow.hour * timelineRowHeight + timelineRowHeight / 2 - container.clientHeight / 2);

    const frameId = window.requestAnimationFrame(() => {
      container.scrollLeft = nextLeft;
      container.scrollTop = nextTop;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [beijingNow.day, beijingNow.hour, beijingNow.month, beijingNow.year]);

  useEffect(() => {
    if (!activeDialog || typeof window === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDialog, isSubmitting]);

  function openHoverCard(event, detail) {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
    const targetRect = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
    const tooltipWidth = 292;
    const tooltipHeight = 228;
    const preferredX = targetRect ? targetRect.right + 12 : event.clientX + 18;
    const fallbackLeft = targetRect ? targetRect.left - tooltipWidth - 12 : 16;
    const anchoredX =
      preferredX + tooltipWidth <= viewportWidth - 12 ? preferredX : Math.max(12, fallbackLeft);
    const preferredY = targetRect
      ? targetRect.top + Math.min(18, Math.max(8, targetRect.height / 3))
      : event.clientY - 12;
    setHoverCard({
      ...detail,
      x: anchoredX,
      y: Math.max(12, Math.min(preferredY, viewportHeight - tooltipHeight))
    });
  }

  function moveHoverCard(event) {
    setHoverCard((current) => current);
  }

  function closeHoverCard() {
    if (typeof window === "undefined") {
      setHoverCard(null);
      return;
    }
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoverCard(null);
      hoverCloseTimerRef.current = null;
    }, 120);
  }

  function keepHoverCardOpen() {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }

  function getDraftMajorValue(draft) {
    return draft.majorMode === NEW_OPTION ? draft.majorInput.trim() : draft.majorSelect;
  }

  function getDraftMinorValue(draft) {
    return draft.minorMode === NEW_OPTION ? draft.minorInput.trim() : draft.minorSelect;
  }

  function getDraftTaskNameValue(draft) {
    return draft.taskNameMode === NEW_OPTION ? draft.taskNameInput.trim() : draft.taskNameSelect;
  }

  function buildEventDraft() {
    const defaultMajor = eventCategoryCatalog.majors[0] ?? "";
    const defaultMinor = eventCategoryCatalog.minorMap.get(defaultMajor)?.[0] ?? "";
    const hasDefaultMajor = Boolean(defaultMajor);
    const hasDefaultMinor = Boolean(defaultMinor);

    return {
      majorMode: hasDefaultMajor ? "existing" : NEW_OPTION,
      majorSelect: hasDefaultMajor ? defaultMajor : NEW_OPTION,
      majorInput: "",
      minorMode: hasDefaultMinor ? "existing" : NEW_OPTION,
      minorSelect: hasDefaultMinor ? defaultMinor : NEW_OPTION,
      minorInput: "",
      taskNameMode: NEW_OPTION,
      taskNameSelect: NEW_OPTION,
      taskNameInput: "",
      startAt: defaultEventStart,
      endAt: defaultEventEnd,
      repeatType: "none",
      repeatUntil: "",
      nature: "non_core",
      permissionLevel: "0",
      color: "#badeff",
      note: ""
    };
  }

  function buildPlanDraft() {
    const defaultMajor = planCategoryCatalog.majors[0] ?? "";
    const defaultMinor = planCategoryCatalog.minorMap.get(defaultMajor)?.[0] ?? "";
    const hasDefaultMajor = Boolean(defaultMajor);
    const hasDefaultMinor = Boolean(defaultMinor);

    return {
      majorMode: hasDefaultMajor ? "existing" : NEW_OPTION,
      majorSelect: hasDefaultMajor ? defaultMajor : NEW_OPTION,
      majorInput: "",
      minorMode: hasDefaultMinor ? "existing" : NEW_OPTION,
      minorSelect: hasDefaultMinor ? defaultMinor : NEW_OPTION,
      minorInput: "",
      taskName: "",
      startDate: defaultPlanDate,
      expectedDueDate: "",
      completedAt: "",
      permissionLevel: "0",
      color: "#badeff",
      note: "",
      nodes: [createPlanNodeDraft({ nodeDate: defaultPlanDate, status: "active", progressValue: "0" })]
    };
  }

  function buildEventDraftFromRecord(event) {
    const hasMajor = eventCategoryCatalog.majors.includes(event.major_category);
    const minorOptions = hasMajor ? eventCategoryCatalog.minorMap.get(event.major_category) ?? [] : [];
    const hasMinor = minorOptions.includes(event.minor_category);
    const nowTime = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day, beijingNow.hour, 0, 0, 0).getTime();
    const recentTaskPresets = buildRecentEventTaskPresets(
      editableEvents,
      event.major_category,
      event.minor_category,
      nowTime
    );
    const hasTaskName = recentTaskPresets.some((preset) => preset.taskName === event.task_name);

    return {
      majorMode: hasMajor ? "existing" : NEW_OPTION,
      majorSelect: hasMajor ? event.major_category : NEW_OPTION,
      majorInput: hasMajor ? "" : event.major_category,
      minorMode: hasMinor ? "existing" : NEW_OPTION,
      minorSelect: hasMinor ? event.minor_category : NEW_OPTION,
      minorInput: hasMinor ? "" : event.minor_category,
      taskNameMode: hasTaskName ? "existing" : NEW_OPTION,
      taskNameSelect: hasTaskName ? event.task_name : NEW_OPTION,
      taskNameInput: hasTaskName ? "" : event.task_name,
      startAt: formatDateTimeField(parseLocalDateTime(event.start_at)),
      endAt: formatDateTimeField(parseLocalDateTime(event.end_at)),
      repeatType: event.repeat_type,
      repeatUntil: event.repeat_until ?? "",
      nature: event.nature,
      permissionLevel: String(event.permission_level ?? 0),
      color: rgbStringToHex(event.color),
      note: event.note ?? "",
      id: event.id
    };
  }

  function buildPlanDraftFromRecord(plan) {
    const hasMajor = planCategoryCatalog.majors.includes(plan.major_category);
    const minorOptions = hasMajor ? planCategoryCatalog.minorMap.get(plan.major_category) ?? [] : [];
    const hasMinor = minorOptions.includes(plan.minor_category);

    const normalizedNodes = normalizePlanNodeDrafts(plan.nodes ?? []);
    const initialNodes = normalizedNodes.length
      ? normalizedNodes
      : [
          createPlanNodeDraft({
            nodeDate: plan.start_date,
            status: plan.current_status ?? "active",
            progressValue: String(plan.current_progress ?? 0)
          })
        ];

    return {
      majorMode: hasMajor ? "existing" : NEW_OPTION,
      majorSelect: hasMajor ? plan.major_category : NEW_OPTION,
      majorInput: hasMajor ? "" : plan.major_category,
      minorMode: hasMinor ? "existing" : NEW_OPTION,
      minorSelect: hasMinor ? plan.minor_category : NEW_OPTION,
      minorInput: hasMinor ? "" : plan.minor_category,
      taskName: plan.task_name,
      startDate: plan.start_date,
      expectedDueDate: plan.expected_due_date ?? "",
      completedAt: plan.completedAt ?? plan.completed_at ?? "",
      permissionLevel: String(plan.permission_level ?? 0),
      color: rgbStringToHex(plan.color),
      note: plan.note ?? "",
      nodes: initialNodes,
      id: plan.id
    };
  }

  function openEditorFromRecord(entity, id) {
    setDialogError("");
    if (entity === "event") {
      const target = editableEvents.find((item) => item.id === id);
      if (!target) return;
      setEventDraft(buildEventDraftFromRecord(target));
      setActiveDialog("event-edit");
      return;
    }

    const target = editablePlans.find((item) => item.id === id);
    if (!target) return;
    setPlanDraft(buildPlanDraftFromRecord(target));
    setActiveDialog("plan-edit");
  }

  function openDialog(type) {
    setDialogError("");
    if (type === "event-create") {
      setEventDraft(buildEventDraft());
    }
    if (type === "plan-create") {
      setPlanDraft(buildPlanDraft());
    }
    if (type === "event-pick") {
      setSelectorFilters([]);
      setSelectorSort("nearest");
      setSelectorAddKind("keyword");
      setSelectorOpenGroups({
        "近1天内": true,
        "近3天内": true,
        "近7天内": true,
        "近30天内": true,
        "重复性事务": true,
        "其他": false
      });
    }
    if (type === "plan-pick") {
      setSelectorFilters([]);
      setSelectorSort("nearest");
      setSelectorAddKind("keyword");
      setSelectorOpenGroups({});
      setSelectorShowInactiveGroups({});
    }
    setActiveDialog(type);
  }

  function closeDialog() {
    if (isSubmitting) return;
    setActiveDialog(null);
    setDialogError("");
  }

  function handleEventMajorModeChange(value) {
    if (value === NEW_OPTION) {
      setEventDraft((current) => ({
        ...current,
        majorMode: NEW_OPTION,
        majorSelect: NEW_OPTION,
        majorInput: "",
        minorMode: NEW_OPTION,
        minorSelect: NEW_OPTION,
        minorInput: "",
        taskNameMode: NEW_OPTION,
        taskNameSelect: NEW_OPTION,
        taskNameInput: ""
      }));
      return;
    }

    const nextMinor = eventCategoryCatalog.minorMap.get(value)?.[0] ?? "";
    setEventDraft((current) => ({
      ...current,
      majorMode: "existing",
      majorSelect: value,
      majorInput: "",
      minorMode: nextMinor ? "existing" : NEW_OPTION,
      minorSelect: nextMinor || NEW_OPTION,
      minorInput: "",
      taskNameMode: NEW_OPTION,
      taskNameSelect: NEW_OPTION,
      taskNameInput: ""
    }));
  }

  function handlePlanMajorModeChange(value) {
    if (value === NEW_OPTION) {
      setPlanDraft((current) => ({
        ...current,
        majorMode: NEW_OPTION,
        majorSelect: NEW_OPTION,
        majorInput: "",
        minorMode: NEW_OPTION,
        minorSelect: NEW_OPTION,
        minorInput: ""
      }));
      return;
    }

    const nextMinor = planCategoryCatalog.minorMap.get(value)?.[0] ?? "";
    setPlanDraft((current) => ({
      ...current,
      majorMode: "existing",
      majorSelect: value,
      majorInput: "",
      minorMode: nextMinor ? "existing" : NEW_OPTION,
      minorSelect: nextMinor || NEW_OPTION,
      minorInput: ""
    }));
  }

  function applyEventTaskPreset(taskName) {
    const preset = recentEventTaskPresets.find((item) => item.taskName === taskName);
    if (!preset) return;

    setEventDraft((current) => ({
      ...current,
      taskNameMode: "existing",
      taskNameSelect: taskName,
      taskNameInput: "",
      repeatType: preset.repeatType,
      repeatUntil: preset.repeatType === "none" ? "" : preset.repeatUntil,
      nature: preset.nature,
      permissionLevel: preset.permissionLevel,
      color: preset.color,
      note: preset.note
    }));
  }

  function updatePlanNodeDraft(clientId, patch) {
    setPlanDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.clientId === clientId ? { ...node, ...patch } : node))
    }));
  }

  function addPlanNodeDraft() {
    setPlanDraft((current) => ({
      ...current,
      nodes: (() => {
        const latestNode = getLatestPlanNode(current.nodes);
        return [
          ...current.nodes,
          createPlanNodeDraft({
            nodeDate: latestNode?.nodeDate ?? latestNode?.node_date ?? current.startDate ?? defaultPlanDate,
            progressValue: String(latestNode?.progressValue ?? latestNode?.progress_value ?? 0),
            status: latestNode?.status ?? "active"
          })
        ];
      })()
    }));
  }

  function syncFirstPlanNodeDate(nextStartDate) {
    setPlanDraft((current) => {
      if (!current.nodes.length) {
        return {
          ...current,
          startDate: nextStartDate,
          nodes: [createPlanNodeDraft({ nodeDate: nextStartDate, status: "active", progressValue: "0" })]
        };
      }

      const sortedNodes = normalizePlanNodeDrafts(current.nodes);
      const firstNodeId = sortedNodes[0]?.clientId;
      return {
        ...current,
        startDate: nextStartDate,
        nodes: current.nodes.map((node) =>
          node.clientId === firstNodeId
            ? {
                ...node,
                nodeDate: nextStartDate
              }
            : node
        )
      };
    });
  }

  function removePlanNodeDraft(clientId) {
    setPlanDraft((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.clientId !== clientId)
    }));
  }

  function serializePlanNodes(nodes) {
    return normalizePlanNodeDrafts(nodes).map((node, index) => ({
      title: node.title.trim(),
      node_date: node.nodeDate,
      progress_value: Number(node.progressValue),
      status: node.status,
      note: node.note.trim(),
      sort_order: index
    }));
  }

  function validatePlanNodes(nodes) {
    const normalizedNodes = [...normalizePlanNodeDrafts(nodes)].sort((left, right) => {
      const dateDiff = left.nodeDate.localeCompare(right.nodeDate);
      if (dateDiff !== 0) return dateDiff;
      return left.clientId.localeCompare(right.clientId);
    });
    if (!normalizedNodes.length) {
      return "每个计划至少需要一个节点。";
    }
    if (normalizedNodes[0].nodeDate !== planDraft.startDate) {
      return "第一个节点必须与计划起始日期保持同日。";
    }
    for (const node of normalizedNodes) {
      if (!node.title.trim()) {
        return "每个计划节点都需要填写节点名称。";
      }
      if (!node.nodeDate) {
        return "每个计划节点都需要填写节点日期。";
      }
      const progressValue = Number(node.progressValue);
      if (Number.isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
        return "计划节点的进度值需要是 0 到 100 之间的数字。";
      }
      if (!PLAN_STATUS_OPTIONS.some((option) => option.value === node.status)) {
        return "计划节点的状态设置无效。";
      }
    }
    return "";
  }

  async function submitEventDraft() {
    const majorCategory = getDraftMajorValue(eventDraft);
    const minorCategory = getDraftMinorValue(eventDraft);
    const taskName = getDraftTaskNameValue(eventDraft);

    if (!majorCategory || !minorCategory || !taskName) {
      setDialogError("请先完整填写大类、小类与事务名称。");
      return;
    }

    if (!eventDraft.startAt || !eventDraft.endAt) {
      setDialogError("请填写事务的开始与结束时间。");
      return;
    }

    if (new Date(eventDraft.endAt).getTime() <= new Date(eventDraft.startAt).getTime()) {
      setDialogError("结束时间需要晚于开始时间。");
      return;
    }

    if (eventDraft.repeatType !== "none" && !eventDraft.repeatUntil) {
      setDialogError("周期性事务需要填写重复截止日期。");
      return;
    }

    setDialogError("");
    await postEditorAction("/api/lepid-eye/add", {
      entity: "event",
      payload: {
        major_category: majorCategory,
        minor_category: minorCategory,
        task_name: taskName,
        start_at: eventDraft.startAt.replace("T", " ") + ":00",
        end_at: eventDraft.endAt.replace("T", " ") + ":00",
        repeat_type: eventDraft.repeatType,
        repeat_until: eventDraft.repeatType === "none" ? null : eventDraft.repeatUntil,
        nature: eventDraft.nature,
        permission_level: Number(eventDraft.permissionLevel),
        color: hexToRgbString(eventDraft.color),
        note: eventDraft.note.trim()
      }
    });
  }

  async function submitPlanDraft() {
    const majorCategory = getDraftMajorValue(planDraft);
    const minorCategory = getDraftMinorValue(planDraft);
    const taskName = planDraft.taskName.trim();

    if (!majorCategory || !minorCategory || !taskName) {
      setDialogError("请先完整填写大类、小类与计划名称。");
      return;
    }

    if (!planDraft.startDate) {
      setDialogError("请填写计划起始日期。");
      return;
    }
    const serializedNodes = serializePlanNodes(planDraft.nodes);
    const latestNode = getLatestPlanNode(serializedNodes);
    if (latestNode?.status === "done" && !planDraft.completedAt) {
      setDialogError("已完成计划需要填写完成日期。");
      return;
    }
    const nodeError = validatePlanNodes(planDraft.nodes);
    if (nodeError) {
      setDialogError(nodeError);
      return;
    }

    setDialogError("");
    await postEditorAction("/api/lepid-eye/add", {
      entity: "plan",
      payload: {
        major_category: majorCategory,
        minor_category: minorCategory,
        task_name: taskName,
        start_date: planDraft.startDate,
        expected_due_date: planDraft.expectedDueDate || null,
        completed_at: latestNode?.status === "done" ? planDraft.completedAt || null : null,
        permission_level: Number(planDraft.permissionLevel),
        color: hexToRgbString(planDraft.color),
        note: planDraft.note.trim(),
        nodes: serializedNodes
      }
    });
  }

  async function submitEventEdit() {
    const majorCategory = getDraftMajorValue(eventDraft);
    const minorCategory = getDraftMinorValue(eventDraft);
    const taskName = getDraftTaskNameValue(eventDraft);

    if (!eventDraft.id) {
      setDialogError("未找到需要编辑的事务对象。");
      return;
    }
    if (!majorCategory || !minorCategory || !taskName) {
      setDialogError("请先完整填写大类、小类与事务名称。");
      return;
    }
    if (!eventDraft.startAt || !eventDraft.endAt) {
      setDialogError("请填写事务的开始与结束时间。");
      return;
    }
    if (new Date(eventDraft.endAt).getTime() <= new Date(eventDraft.startAt).getTime()) {
      setDialogError("结束时间需要晚于开始时间。");
      return;
    }

    setDialogError("");
    await postEditorAction("/api/lepid-eye/mutate", {
      entity: "event",
      action: "update",
      id: eventDraft.id,
      payload: {
        major_category: majorCategory,
        minor_category: minorCategory,
        task_name: taskName,
        start_at: eventDraft.startAt.replace("T", " ") + ":00",
        end_at: eventDraft.endAt.replace("T", " ") + ":00",
        repeat_type: eventDraft.repeatType,
        repeat_until: eventDraft.repeatType === "none" ? null : eventDraft.repeatUntil || null,
        nature: eventDraft.nature,
        permission_level: Number(eventDraft.permissionLevel),
        color: hexToRgbString(eventDraft.color),
        note: eventDraft.note.trim()
      }
    });
  }

  async function submitPlanEdit() {
    const majorCategory = getDraftMajorValue(planDraft);
    const minorCategory = getDraftMinorValue(planDraft);
    const taskName = planDraft.taskName.trim();

    if (!planDraft.id) {
      setDialogError("未找到需要编辑的计划对象。");
      return;
    }
    if (!majorCategory || !minorCategory || !taskName) {
      setDialogError("请先完整填写大类、小类与计划名称。");
      return;
    }
    if (!planDraft.startDate) {
      setDialogError("请填写计划起始日期。");
      return;
    }
    const serializedNodes = serializePlanNodes(planDraft.nodes);
    const latestNode = getLatestPlanNode(serializedNodes);
    if (latestNode?.status === "done" && !planDraft.completedAt) {
      setDialogError("已完成计划需要填写完成日期。");
      return;
    }
    const nodeError = validatePlanNodes(planDraft.nodes);
    if (nodeError) {
      setDialogError(nodeError);
      return;
    }

    setDialogError("");
    await postEditorAction("/api/lepid-eye/mutate", {
      entity: "plan",
      action: "update",
      id: planDraft.id,
      payload: {
        major_category: majorCategory,
        minor_category: minorCategory,
        task_name: taskName,
        start_date: planDraft.startDate,
        expected_due_date: planDraft.expectedDueDate || null,
        completed_at: latestNode?.status === "done" ? planDraft.completedAt || null : null,
        permission_level: Number(planDraft.permissionLevel),
        color: hexToRgbString(planDraft.color),
        note: planDraft.note.trim(),
        nodes: serializedNodes
      }
    });
  }

  async function deleteCurrentRecord(entity) {
    const currentId = entity === "event" ? eventDraft.id : planDraft.id;
    if (!currentId) return;
    if (!window.confirm(entity === "event" ? "确定删除这个事务吗？" : "确定删除这个计划吗？")) {
      return;
    }
    await postEditorAction("/api/lepid-eye/mutate", {
      entity,
      action: "delete",
      id: currentId,
      payload: {}
    });
  }

  async function postEditorAction(path, payload) {
    if (!editorKey) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editorKey,
          ...payload
        })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "操作失败");
      }
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleHorizontalWheel(event) {
    const container = event.currentTarget;
    if (!container || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const target = event.target;
    const forceHorizontal =
      target instanceof Element && Boolean(target.closest(".timeline-header, .plan-header"));
    if (forceHorizontal || event.shiftKey || container.scrollHeight <= container.clientHeight + 2) {
      container.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }

  const currentSelectorEntity = activeDialog?.startsWith("plan") ? "plan" : "event";
  const selectorKindOptions = useMemo(
    () => getSelectorKindOptions(currentSelectorEntity),
    [currentSelectorEntity]
  );

  const selectorRecords = useMemo(() => {
    const nowTime = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day, beijingNow.hour, 0, 0, 0).getTime();
    const source = currentSelectorEntity === "plan" ? editablePlans : editableEvents;

    const filtered = source.filter((record) =>
      selectorFilters.every((filter) => {
        if (filter.kind === "keyword") {
          const keyword = filter.value.trim().toLowerCase();
          if (!keyword) return true;
          const haystack = [
            record.task_name,
            record.major_category,
            record.minor_category,
            record.note ?? ""
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(keyword);
        }

        if (filter.kind === "major") {
          return !filter.value || record.major_category === filter.value;
        }

        if (filter.kind === "permission") {
          return String(record.permission_level ?? 0) === String(filter.value);
        }

        if (filter.kind === "date_after") {
          if (!filter.value) return true;
          const reference = currentSelectorEntity === "plan" ? record.start_date : record.start_at.slice(0, 10);
          return reference >= filter.value;
        }

        if (filter.kind === "date_before") {
          if (!filter.value) return true;
          const reference = currentSelectorEntity === "plan" ? record.start_date : record.start_at.slice(0, 10);
          return reference <= filter.value;
        }

        if (currentSelectorEntity === "plan" && filter.kind === "status") {
          return record.currentStatus === filter.value;
        }

        if (currentSelectorEntity === "event" && filter.kind === "nature") {
          return record.nature === filter.value;
        }

        if (currentSelectorEntity === "event" && filter.kind === "repeat") {
          return record.repeat_type === filter.value;
        }

        return true;
      })
    );

    const sorted = [...filtered].sort((left, right) => {
      if (currentSelectorEntity === "plan") {
        const majorDiff = left.major_category.localeCompare(right.major_category, "zh-Hans-CN");
        if (majorDiff !== 0) return majorDiff;
        const minorDiff = left.minor_category.localeCompare(right.minor_category, "zh-Hans-CN");
        if (minorDiff !== 0) return minorDiff;
        return left.task_name.localeCompare(right.task_name, "zh-Hans-CN");
      }

      if (selectorSort === "nearest") {
        return Math.abs(left.anchorTime - nowTime) - Math.abs(right.anchorTime - nowTime);
      }
      if (selectorSort === "latest") {
        return right.anchorTime - left.anchorTime;
      }
      if (selectorSort === "earliest") {
        return left.anchorTime - right.anchorTime;
      }
      return left.task_name.localeCompare(right.task_name, "zh-Hans-CN");
    });

    return sorted;
  }, [activeDialog, beijingNow.day, beijingNow.hour, beijingNow.month, beijingNow.year, editableEvents, editablePlans, currentSelectorEntity, selectorFilters, selectorSort]);

  const selectorGroups = useMemo(() => {
    const now = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day, beijingNow.hour, 0, 0, 0);

    if (currentSelectorEntity === "event") {
      const orderedLabels = ["近1天内", "近3天内", "近7天内", "近30天内", "重复性事务", "其他"];
      const groups = new Map(orderedLabels.map((label) => [label, []]));
      selectorRecords.forEach((record) => {
        groups.get(getEventGroupingLabel(record, now))?.push(record);
      });
      return orderedLabels.map((label) => ({
        label,
        items: groups.get(label) ?? []
      }));
    }

    const groups = new Map();
    selectorRecords.forEach((record) => {
      if (!groups.has(record.major_category)) {
        groups.set(record.major_category, []);
      }
      groups.get(record.major_category).push(record);
    });

    return [...groups.entries()].map(([label, items]) => ({
      label,
      items
    }));
  }, [beijingNow.day, beijingNow.hour, beijingNow.month, beijingNow.year, currentSelectorEntity, selectorRecords]);

  const planAxis = useMemo(() => {
    const today = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day);
    const currentPeriodStart = getPlanPeriodStart(today, planScale);
    return Array.from({ length: planColumnCount }, (_, index) => {
      const rawOffset = index - planPastDays;
      const startDate = addPlanPeriods(currentPeriodStart, planScale, rawOffset);
      const endDate = addPlanPeriods(startDate, planScale, 1);
      const isToday = today >= startDate && today < endDate;
      return {
        key: `${planScale}-${index}-${startDate.toISOString()}`,
        rawOffset,
        label: getPlanPeriodLabel(startDate, planScale),
        startDate,
        endDate,
        isToday
      };
    });
  }, [beijingNow.day, beijingNow.month, beijingNow.year, planColumnCount, planScale]);

  const timelineDays = useMemo(() => {
    const base = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day);
    return Array.from({ length: timelinePastDays + timelineFutureDays + 1 }, (_, index) => {
      const offset = index - timelinePastDays;
      const date = addDays(base, offset);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        label: formatDateLabel(date),
        offset,
        isToday: offset === 0
      };
    });
  }, [beijingNow.day, beijingNow.month, beijingNow.year]);

  const timelineTasks = useMemo(
    () => {
      const rangeStart = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day, 0, 0, 0, 0);
      const visibleStart = addDays(rangeStart, -timelinePastDays);
      const visibleEnd = addDays(rangeStart, timelineFutureDays + 1);
      return expandTimelineEvents(filteredEvents, visibleStart, visibleEnd, timelinePastDays);
    },
    [beijingNow.day, beijingNow.month, beijingNow.year, filteredEvents]
  );

  const sortedPlans = useMemo(() => {
    const stateOrder = { primary: 0, active: 1, inactive: 2, done: 3 };
    const visiblePlanRows = showInactivePlanRows
      ? filteredPlans
      : filteredPlans.filter((plan) => plan.currentStatus !== "inactive");
    return [...visiblePlanRows].sort((a, b) => {
      const stateDiff = (stateOrder[a.currentStatus] ?? 9) - (stateOrder[b.currentStatus] ?? 9);
      if (stateDiff !== 0) return stateDiff;
      return a.start_date.localeCompare(b.start_date);
    });
  }, [filteredPlans, showInactivePlanRows]);

  const eventMinorOptions = useMemo(() => {
    const majorValue = eventDraft.majorMode === NEW_OPTION ? "" : eventDraft.majorSelect;
    return majorValue ? eventCategoryCatalog.minorMap.get(majorValue) ?? [] : [];
  }, [eventCategoryCatalog.minorMap, eventDraft.majorMode, eventDraft.majorSelect]);

  const recentEventTaskPresets = useMemo(() => {
    const majorValue = eventDraft.majorMode === NEW_OPTION ? "" : eventDraft.majorSelect;
    const minorValue = eventDraft.minorMode === NEW_OPTION ? "" : eventDraft.minorSelect;
    const nowTime = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day, beijingNow.hour, 0, 0, 0).getTime();
    return buildRecentEventTaskPresets(editableEvents, majorValue, minorValue, nowTime);
  }, [
    beijingNow.day,
    beijingNow.hour,
    beijingNow.month,
    beijingNow.year,
    editableEvents,
    eventDraft.majorMode,
    eventDraft.majorSelect,
    eventDraft.minorMode,
    eventDraft.minorSelect
  ]);

  const eventTaskNameOptions = useMemo(
    () => recentEventTaskPresets.map((preset) => preset.taskName),
    [recentEventTaskPresets]
  );

  useEffect(() => {
    if (eventDraft.taskNameMode !== "existing") return;
    if (eventTaskNameOptions.includes(eventDraft.taskNameSelect)) return;
    setEventDraft((current) => ({
      ...current,
      taskNameMode: NEW_OPTION,
      taskNameSelect: NEW_OPTION,
      taskNameInput: ""
    }));
  }, [eventDraft.taskNameMode, eventDraft.taskNameSelect, eventTaskNameOptions]);

  const planMinorOptions = useMemo(() => {
    const majorValue = planDraft.majorMode === NEW_OPTION ? "" : planDraft.majorSelect;
    return majorValue ? planCategoryCatalog.minorMap.get(majorValue) ?? [] : [];
  }, [planCategoryCatalog.minorMap, planDraft.majorMode, planDraft.majorSelect]);
  const isEventDialog = activeDialog === "event-create" || activeDialog === "event-edit";
  const isPlanDialog = activeDialog === "plan-create" || activeDialog === "plan-edit";
  const isSelectorDialog = activeDialog === "event-pick" || activeDialog === "plan-pick";
  const activeEventRecord = eventDraft.id ? editableEvents.find((item) => item.id === eventDraft.id) ?? null : null;
  const activePlanRecord = planDraft.id ? editablePlans.find((item) => item.id === planDraft.id) ?? null : null;
  const planDraftLatestNode = useMemo(() => getLatestPlanNode(planDraft.nodes), [planDraft.nodes]);

  return (
    <main className={`lepid-eye-shell ${isDarkMode ? "dark" : "light"}`}>
      <canvas ref={canvasRef} className="butterfly-canvas" />
      <ReturnMenus />

      <div className="theme-background" aria-hidden="true">
        <div className="day-gradient" style={{ opacity: isDarkMode ? 0 : 1 }} />
        <div className="night-gradient" style={{ opacity: isDarkMode ? 1 : 0 }} />
        <div className="background-layer" />
      </div>

      <div className="page-body">
        <section className="grid-layout">
          <article ref={docPanelRef} className="panel doc-panel">
            <div className="eyebrow">Butterfly Eye</div>
            <h1 className="doc-title">蝶眼系统</h1>
            <div className="doc-intro">
              {introLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="access-banner" aria-label={`当前权限等级：${getAccessLabel(accessLevel)}`}>
              {viewerName ? (
                <div className="viewer-badge" aria-label={`访问用户：${viewerName}`}>
                  <span className="viewer-badge-label">访问用户</span>
                  <strong>{viewerName}</strong>
                </div>
              ) : null}
              <span className="access-arrow left" aria-hidden="true" />
              <div className="access-core">
                <div className="access-caption">当前权限等级</div>
                <div className="access-level">{getAccessLabel(accessLevel)}</div>
              </div>
              <span className="access-arrow right" aria-hidden="true" />
            </div>
            {isCreator ? (
              <div className="admin-actions-card" aria-label="管理员操作">
                <button
                  type="button"
                  className="admin-action-btn event-create"
                  onClick={() => openDialog("event-create")}
                  disabled={isSubmitting}
                >
                  新增事务
                </button>
                <button
                  type="button"
                  className="admin-action-btn event-edit"
                  onClick={() => openDialog("event-pick")}
                  disabled={isSubmitting}
                >
                  编辑事务
                </button>
                <button
                  type="button"
                  className="admin-action-btn plan-create"
                  onClick={() => openDialog("plan-create")}
                  disabled={isSubmitting}
                >
                  新增计划
                </button>
                <button
                  type="button"
                  className="admin-action-btn plan-edit"
                  onClick={() => openDialog("plan-pick")}
                  disabled={isSubmitting}
                >
                  编辑计划
                </button>
              </div>
            ) : (
              <div className="access-matrix" role="table" aria-label="权限访问矩阵">
                <div className="access-row access-head" role="row">
                  <span role="columnheader">数据敏感等级</span>
                  <span role="columnheader">当前权限可以访问的情况</span>
                </div>
                {permissionMatrix.map((row) => (
                  <div key={row.level} className="access-row" role="row">
                    <span role="cell">{row.level}</span>
                    <span role="cell">{row.access}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article
            ref={timelinePanelRef}
            className="panel timeline-panel"
            style={timelinePanelHeight ? { height: `${timelinePanelHeight}px` } : undefined}
          >
            <div className="panel-head">
              <h2>事务规划时间轴</h2>
              <div className="panel-controls">
                <label className="category-filter">
                  <span>大类</span>
                  <select value={eventCategoryFilter} onChange={(event) => setEventCategoryFilter(event.target.value)}>
                    {eventCategoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <span>北京时间</span>
              </div>
            </div>

            <div className="timeline-scroll compact" ref={timelineScrollRef} onWheel={handleHorizontalWheel}>
              <div
                className="timeline-header"
                style={{
                  gridTemplateColumns: `${timelineHourLabelWidth}px repeat(${timelineDays.length}, ${timelineDayWidth}px)`
                }}
              >
                <div className="timeline-head-side">北京时间</div>
                {timelineDays.map((day) => (
                  <div key={day.key} className={`timeline-day-head ${day.isToday ? "today" : ""}`}>
                    {day.label}
                  </div>
                ))}
              </div>

              <div
                className="timeline-grid"
                style={{
                  gridTemplateColumns: `${timelineHourLabelWidth}px repeat(${timelineDays.length}, ${timelineDayWidth}px)`
                }}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <FragmentRow
                    key={hour}
                    hour={hour}
                    days={timelineDays}
                    currentHour={beijingNow.hour}
                    taskRows={timelineTasks}
                    isCreator={isCreator}
                    onHover={openHoverCard}
                    onHoverMove={moveHoverCard}
                    onHoverEnd={closeHoverCard}
                  />
                ))}
                <div
                  className="timeline-event-layer"
                  style={{
                    left: `${timelineHourLabelWidth}px`,
                    width: `${timelineDays.length * timelineDayWidth}px`,
                    height: `${24 * timelineRowHeight}px`
                  }}
                >
                  {timelineDays.map((day, dayIndex) => (
                    <TimelineDayColumn
                      key={day.key}
                      day={day}
                      dayIndex={dayIndex}
                      taskRows={timelineTasks}
                      isCreator={isCreator}
                      onHover={openHoverCard}
                      onHoverMove={moveHoverCard}
                      onHoverEnd={closeHoverCard}
                    />
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="panel plan-panel">
            <div className="panel-head">
              <h2>计划轨道总览</h2>
              <div className="panel-controls">
                <label className="category-filter">
                  <span>大类</span>
                  <select value={planCategoryFilter} onChange={(event) => setPlanCategoryFilter(event.target.value)}>
                    {planCategoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={showInactivePlanRows}
                    onChange={(event) => setShowInactivePlanRows(event.target.checked)}
                  />
                  <span>展开非活跃计划</span>
                </label>
                <div className="scale-switch" role="tablist" aria-label="计划轨道尺度">
                  {Object.entries(planScaleMap).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`scale-btn ${planScale === key ? "active" : ""}`}
                      onClick={() => setPlanScale(key)}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="plan-scroll" ref={planScrollRef} onWheel={handleHorizontalWheel}>
              <div
                className="plan-header"
                style={{
                  gridTemplateColumns: `${planLabelWidth}px repeat(${planColumnCount}, ${planUnitWidth}px)`
                }}
              >
                <div className="plan-side-head">计划</div>
                {planAxis.map((axis) => {
                  return (
                    <div key={axis.key} className={`plan-day-head ${axis.isToday ? "today" : ""}`}>
                      {axis.label}
                    </div>
                  );
                })}
              </div>

              <div className="plan-body">
                <div
                  className="today-column-line"
                  style={{
                    left: `${planLabelWidth + getPlanAxisPosition(new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day), planAxis, planUnitWidth)}px`
                  }}
                />
                {sortedPlans.map((plan) => {
                  const startDate = parseLocalDate(plan.start_date);
                  const expectedDueDate = plan.expected_due_date ? parseLocalDate(plan.expected_due_date) : null;
                  const completedAt = plan.completedAt ? parseLocalDate(plan.completedAt) : null;
                  const today = new Date(beijingNow.year, beijingNow.month - 1, beijingNow.day);
                  const isRunningState =
                    plan.currentStatus === "primary" || plan.currentStatus === "active" || plan.currentStatus === "inactive";
                  const effectiveStartDate = startDate > today ? today : startDate;
                  const displayEndDate = isRunningState ? today : completedAt ?? expectedDueDate ?? startDate;
                  const planSegments = buildPlanTrackSegments(plan, displayEndDate);
                  const dueIndex = expectedDueDate ? findPlanAxisIndex(expectedDueDate, planAxis) : null;
                  const startCenter = getPlanAxisPosition(effectiveStartDate, planAxis, planUnitWidth);
                  const endCenter = getPlanAxisPosition(displayEndDate, planAxis, planUnitWidth);
                  const planHoverDetail = {
                    type: "plan",
                    title: plan.displayTaskName,
                    lines: [
                      `大类：${plan.displayMajor}`,
                      `小类：${plan.displayMinor}`,
                      `状态：${statusLabel(plan.currentStatus)}`,
                      `进度：${plan.currentProgress}%`,
                      `起始：${plan.start_date}`,
                      `截止：${plan.expected_due_date ?? "未设置"}`,
                      `完成：${plan.currentStatus === "done" ? plan.completedAt ?? "未记录" : "未完成"}`,
                      plan.displayNote || "无备注"
                    ],
                    editTarget: isCreator ? { entity: "plan", id: plan.id } : null
                  };

                  return (
                    <div
                      key={plan.id}
                      className="plan-row"
                      style={{
                        gridTemplateColumns: `${planLabelWidth}px repeat(${planColumnCount}, ${planUnitWidth}px)`
                      }}
                      >
                        <div
                          className={`plan-label ${mapPlanState(plan.currentStatus)}`}
                          style={{ "--plan-color": plan.color }}
                          onMouseEnter={(event) => openHoverCard(event, planHoverDetail)}
                          onMouseMove={moveHoverCard}
                        onMouseLeave={closeHoverCard}
                      >
                        <strong>{plan.displayTaskName}</strong>
                        <span>{plan.displayMajor} · {plan.displayMinor}</span>
                      </div>

                      <div
                        className="plan-track"
                        style={{ gridColumn: `2 / span ${planColumnCount}`, backgroundSize: `${planUnitWidth}px 100%` }}
                      >
                        {dueIndex !== null && dueIndex >= 0 && dueIndex < planColumnCount && (
                          <div className="plan-due-cell" style={{ left: `${dueIndex * planUnitWidth}px`, width: `${planUnitWidth}px` }} />
                        )}
                        {planSegments.map((segment, index) => {
                          const segmentStart = index === 0 ? effectiveStartDate : segment.startDate;
                          const segmentLeft = getPlanAxisPosition(segmentStart, planAxis, planUnitWidth);
                          const segmentRight = getPlanAxisPosition(segment.endDate, planAxis, planUnitWidth);
                          const segmentWidth = Math.max(segmentRight - segmentLeft, 4);
                          if (segmentWidth <= 0) return null;
                          return (
                            <div
                              key={`${plan.id}-${segment.startDate.toISOString()}-${segment.status}`}
                              className={`plan-bar ${mapPlanState(segment.status)}`}
                              style={{
                                left: `${segmentLeft}px`,
                                width: `${segmentWidth}px`,
                                "--plan-color": plan.color,
                                "--plan-segment-fill": buildPlanSegmentFill(
                                  plan.color,
                                  segment.progress,
                                  segment.status
                                )
                              }}
                            />
                          );
                        })}
                        <div className="plan-node start" style={{ left: `${startCenter - 9}px`, "--plan-color": plan.color }} />
                        {plan.currentStatus === "done" && (
                          <div className="plan-node end" style={{ left: `${endCenter - 9}px`, "--plan-color": plan.color }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <div className="bottom-row">
            <article className="panel stats-panel">
              <div className="panel-head">
                <h2>统计</h2>
                <div className="scale-switch" role="tablist" aria-label="统计周期">
                  {statsRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`scale-btn ${statsRangeDays === option.value ? "active" : ""}`}
                      onClick={() => setStatsRangeDays(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stats-content">
                <div className="pie-block">
                  <PieDonutCard segments={statsData.pieSegments} isDarkMode={isDarkMode} />
                  <div className="pie-list">
                    {statsData.pieSegments.map((segment) => (
                      <div key={segment.label} className="pie-item">
                        <span className="pie-dot" style={{ background: segment.color }} />
                        <span>{segment.label}</span>
                        <strong>{segment.value}%</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stat-list">
                  <div className="stat-card">
                    <span>新开启计划数</span>
                    <strong>{statsData.planStats.started}</strong>
                  </div>
                  <div className="stat-card">
                    <span>已完成计划数</span>
                    <strong>{statsData.planStats.completed}</strong>
                  </div>
                  <div className="stat-card">
                    <span>剩余计划数</span>
                    <strong>{statsData.planStats.remaining}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel ai-panel">
              <div className="panel-head">
                <h2>AI 分析</h2>
              </div>
              <div className="ai-placeholder">{bootstrap.aiStatus}</div>
            </article>
          </div>
        </section>
      </div>

      {hoverCard && (
        <div
          className="lepid-eye-tooltip"
          style={{
            left: `${hoverCard.x}px`,
            top: `${hoverCard.y}px`
          }}
          onMouseEnter={keepHoverCardOpen}
          onMouseLeave={closeHoverCard}
        >
          <strong>{hoverCard.title}</strong>
          {hoverCard.lines.map((line, index) => (
            <div key={`${hoverCard.type}-${index}`}>{line}</div>
          ))}
          {isCreator && hoverCard.editTarget ? (
            <button
              type="button"
              className="tooltip-edit-btn"
              onClick={() => {
                openEditorFromRecord(hoverCard.editTarget.entity, hoverCard.editTarget.id);
                setHoverCard(null);
              }}
            >
              修改此项
            </button>
          ) : null}
        </div>
      )}

      {activeDialog && (
        <div className="lepid-eye-dialog-root" role="presentation" onClick={closeDialog}>
          <div className="lepid-eye-dialog-backdrop" aria-hidden="true" />
          <section
            className="lepid-eye-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lepid-eye-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <div className="dialog-eyebrow">Butterfly Eye</div>
                <h3 id="lepid-eye-dialog-title">
                  {activeDialog === "event-create" && "新增事务"}
                  {activeDialog === "plan-create" && "新增计划"}
                  {activeDialog === "event-pick" && "选择要编辑的事务"}
                  {activeDialog === "plan-pick" && "选择要编辑的计划"}
                  {activeDialog === "event-edit" && "编辑事务"}
                  {activeDialog === "plan-edit" && "编辑计划"}
                </h3>
              </div>
              <button type="button" className="dialog-close" onClick={closeDialog} disabled={isSubmitting} aria-label="关闭弹窗">
                ×
              </button>
            </div>

            {isSelectorDialog ? (
              <>
                <div className="selector-toolbar">
                  <div className="selector-add-filter">
                    <select value={selectorAddKind} onChange={(event) => setSelectorAddKind(event.target.value)}>
                      {selectorKindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dialog-btn secondary compact"
                      onClick={() =>
                        setSelectorFilters((current) => [
                          ...current,
                          createSelectorFilter(
                            currentSelectorEntity,
                            selectorAddKind,
                            currentSelectorEntity === "plan" ? planCategoryCatalog.majors : eventCategoryCatalog.majors
                          )
                        ])
                      }
                    >
                      新增筛选
                    </button>
                  </div>

                  {currentSelectorEntity === "event" ? (
                    <label className="dialog-field inline">
                      <span>排序方式</span>
                      <select value={selectorSort} onChange={(event) => setSelectorSort(event.target.value)}>
                        <option value="nearest">距离现在最近</option>
                        <option value="latest">时间最新</option>
                        <option value="earliest">时间最早</option>
                        <option value="name">名称排序</option>
                      </select>
                    </label>
                  ) : null}
                </div>

                {selectorFilters.length ? (
                  <div className="selector-filters">
                    {selectorFilters.map((filter) => (
                      <div key={filter.id} className="selector-filter-row">
                        <span className="selector-filter-label">
                          {selectorKindOptions.find((option) => option.value === filter.kind)?.label ?? filter.kind}
                        </span>

                        {filter.kind === "keyword" && (
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                            placeholder="输入关键词"
                          />
                        )}

                        {filter.kind === "major" && (
                          <select
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          >
                            {(currentSelectorEntity === "plan" ? planCategoryCatalog.majors : eventCategoryCatalog.majors).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}

                        {filter.kind === "status" && (
                          <select
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          >
                            {PLAN_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {filter.kind === "nature" && (
                          <select
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          >
                            {EVENT_NATURE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {filter.kind === "repeat" && (
                          <select
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          >
                            {EVENT_REPEAT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {filter.kind === "permission" && (
                          <select
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          >
                            {PERMISSION_LEVEL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {(filter.kind === "date_after" || filter.kind === "date_before") && (
                          <input
                            type="date"
                            value={filter.value}
                            onChange={(event) =>
                              setSelectorFilters((current) =>
                                current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item))
                              )
                            }
                          />
                        )}

                        <button
                          type="button"
                          className="selector-filter-remove"
                          onClick={() => setSelectorFilters((current) => current.filter((item) => item.id !== filter.id))}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="selector-list">
                  {selectorGroups.some((group) => group.items.length) ? (
                    selectorGroups.map((group) => {
                      const visibleItems =
                        currentSelectorEntity === "plan" && !(selectorShowInactiveGroups[group.label] ?? false)
                          ? group.items.filter((record) => record.currentStatus === "primary" || record.currentStatus === "active")
                          : group.items;

                      return (
                        <section key={`${currentSelectorEntity}-${group.label}`} className="selector-group">
                          <div className="selector-group-head">
                            <button
                              type="button"
                              className="selector-group-toggle"
                              onClick={() =>
                                setSelectorOpenGroups((current) => ({
                                  ...current,
                                  [group.label]: !(current[group.label] ?? true)
                                }))
                              }
                            >
                              <span>{group.label}</span>
                              <strong>{visibleItems.length}</strong>
                            </button>
                            {currentSelectorEntity === "plan" ? (
                              <label className="selector-group-check">
                                <input
                                  type="checkbox"
                                  checked={selectorShowInactiveGroups[group.label] ?? false}
                                  onChange={(event) =>
                                    setSelectorShowInactiveGroups((current) => ({
                                      ...current,
                                      [group.label]: event.target.checked
                                    }))
                                  }
                                />
                                <span>展开非活跃计划</span>
                              </label>
                            ) : null}
                          </div>
                          {(selectorOpenGroups[group.label] ?? true) && (
                            <div className="selector-group-body">
                              {visibleItems.length ? (
                                visibleItems.map((record) => (
                                <button
                                  key={`${currentSelectorEntity}-${record.id}`}
                                  type="button"
                                  className="selector-record"
                                  onClick={() => openEditorFromRecord(currentSelectorEntity, record.id)}
                                >
                                  <div className="selector-record-head">
                                    <strong>{record.task_name}</strong>
                                    <span>{record.major_category} · {record.minor_category}</span>
                                  </div>
                                  <div className="selector-record-meta">
                                    {currentSelectorEntity === "event" ? (
                                      <>
                                        <span>{formatDateTimeDisplay(record.start_at)}</span>
                                        <span>{formatDateTimeDisplay(record.end_at)}</span>
                                        <span>{EVENT_NATURE_OPTIONS.find((option) => option.value === record.nature)?.label ?? record.nature}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>{record.minor_category} · {record.task_name}</span>
                                        <span>开始：{record.start_date}</span>
                                        <span>状态：{statusLabel(record.currentStatus)}</span>
                                      </>
                                    )}
                                  </div>
                                </button>
                                ))
                              ) : (
                                <div className="selector-group-empty">当前分组没有对象。</div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })
                  ) : (
                    <div className="selector-empty">当前筛选条件下没有可编辑对象。</div>
                  )}
                </div>
              </>
            ) : isEventDialog ? (
              <div className="dialog-form">
                {activeDialog === "event-edit" && activeEventRecord ? (
                  <details className="dialog-summary">
                    <summary>当前编辑对象</summary>
                    <div className="dialog-summary-grid">
                      <span>{activeEventRecord.task_name}</span>
                      <span>{activeEventRecord.major_category} · {activeEventRecord.minor_category}</span>
                      <span>{formatDateTimeDisplay(activeEventRecord.start_at)}</span>
                      <span>{formatDateTimeDisplay(activeEventRecord.end_at)}</span>
                    </div>
                  </details>
                ) : null}

                <label className="dialog-field">
                  <span>事务大类</span>
                  <select
                    value={eventDraft.majorMode === NEW_OPTION ? NEW_OPTION : eventDraft.majorSelect}
                    onChange={(event) => handleEventMajorModeChange(event.target.value)}
                  >
                    {eventCategoryCatalog.majors.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_OPTION}>新增大类</option>
                  </select>
                </label>

                {eventDraft.majorMode === NEW_OPTION && (
                  <label className="dialog-field">
                    <span>新大类名称</span>
                    <input
                      type="text"
                      value={eventDraft.majorInput}
                      onChange={(event) => setEventDraft((current) => ({ ...current, majorInput: event.target.value }))}
                      placeholder="例如：创作 / 研究 / 旅行"
                    />
                  </label>
                )}

                <label className="dialog-field">
                  <span>事务小类</span>
                  <select
                    value={eventDraft.minorMode === NEW_OPTION ? NEW_OPTION : eventDraft.minorSelect}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEventDraft((current) => ({
                        ...current,
                        minorMode: value === NEW_OPTION ? NEW_OPTION : "existing",
                        minorSelect: value === NEW_OPTION ? NEW_OPTION : value,
                        minorInput: "",
                        taskNameMode: NEW_OPTION,
                        taskNameSelect: NEW_OPTION,
                        taskNameInput: ""
                      }));
                    }}
                  >
                    {eventMinorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_OPTION}>新增小类</option>
                  </select>
                </label>

                {eventDraft.minorMode === NEW_OPTION && (
                  <label className="dialog-field">
                    <span>新小类名称</span>
                    <input
                      type="text"
                      value={eventDraft.minorInput}
                      onChange={(event) => setEventDraft((current) => ({ ...current, minorInput: event.target.value }))}
                      placeholder="例如：蝶眼系统 / 例会 / 复盘"
                    />
                  </label>
                )}

                <label className="dialog-field wide">
                  <span>事务名称</span>
                  <select
                    value={eventDraft.taskNameMode === NEW_OPTION ? NEW_OPTION : eventDraft.taskNameSelect}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === NEW_OPTION) {
                        setEventDraft((current) => ({
                          ...current,
                          taskNameMode: NEW_OPTION,
                          taskNameSelect: NEW_OPTION,
                          taskNameInput: ""
                        }));
                        return;
                      }
                      applyEventTaskPreset(value);
                    }}
                  >
                    {eventTaskNameOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_OPTION}>新增事务名称</option>
                  </select>
                </label>

                {eventDraft.taskNameMode === NEW_OPTION && (
                  <label className="dialog-field wide">
                    <span>新事务名称</span>
                    <input
                      type="text"
                      value={eventDraft.taskNameInput}
                      onChange={(event) => setEventDraft((current) => ({ ...current, taskNameInput: event.target.value }))}
                      placeholder="写一个清晰的事务名称"
                    />
                  </label>
                )}

                <label className="dialog-field">
                  <span>开始时间</span>
                  <input
                    type="datetime-local"
                    value={eventDraft.startAt}
                    onChange={(event) => setEventDraft((current) => ({ ...current, startAt: event.target.value }))}
                  />
                </label>

                <label className="dialog-field">
                  <span>结束时间</span>
                  <input
                    type="datetime-local"
                    value={eventDraft.endAt}
                    onChange={(event) => setEventDraft((current) => ({ ...current, endAt: event.target.value }))}
                  />
                </label>

                <label className="dialog-field">
                  <span>重复方式</span>
                  <select
                    value={eventDraft.repeatType}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        repeatType: event.target.value,
                        repeatUntil: event.target.value === "none" ? "" : current.repeatUntil
                      }))
                    }
                  >
                    {EVENT_REPEAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dialog-field">
                  <span>事务性质</span>
                  <select
                    value={eventDraft.nature}
                    onChange={(event) => setEventDraft((current) => ({ ...current, nature: event.target.value }))}
                  >
                    {EVENT_NATURE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {eventDraft.repeatType !== "none" && (
                  <label className="dialog-field">
                    <span>重复截止</span>
                    <input
                      type="date"
                      value={eventDraft.repeatUntil}
                      onChange={(event) => setEventDraft((current) => ({ ...current, repeatUntil: event.target.value }))}
                    />
                  </label>
                )}

                <label className="dialog-field">
                  <span>权限等级</span>
                  <select
                    value={eventDraft.permissionLevel}
                    onChange={(event) => setEventDraft((current) => ({ ...current, permissionLevel: event.target.value }))}
                  >
                    {PERMISSION_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dialog-field color-field">
                  <span>渲染颜色</span>
                  <div className="dialog-color-control">
                    <input
                      type="color"
                      value={eventDraft.color}
                      onChange={(event) => setEventDraft((current) => ({ ...current, color: event.target.value }))}
                    />
                    <strong>{eventDraft.color.toUpperCase()}</strong>
                  </div>
                </label>

                <label className="dialog-field wide">
                  <span>备注</span>
                  <textarea
                    rows={4}
                    value={eventDraft.note}
                    onChange={(event) => setEventDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="鼠标悬浮时展示的说明信息"
                  />
                </label>
              </div>
            ) : isPlanDialog ? (
              <div className="dialog-form">
                {activeDialog === "plan-edit" && activePlanRecord ? (
                  <details className="dialog-summary">
                    <summary>当前编辑对象</summary>
                    <div className="dialog-summary-grid">
                      <span>{activePlanRecord.task_name}</span>
                      <span>{activePlanRecord.major_category} · {activePlanRecord.minor_category}</span>
                      <span>开始：{activePlanRecord.start_date}</span>
                      <span>状态：{statusLabel(activePlanRecord.currentStatus)}</span>
                    </div>
                  </details>
                ) : null}

                <label className="dialog-field">
                  <span>计划大类</span>
                  <select
                    value={planDraft.majorMode === NEW_OPTION ? NEW_OPTION : planDraft.majorSelect}
                    onChange={(event) => handlePlanMajorModeChange(event.target.value)}
                  >
                    {planCategoryCatalog.majors.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_OPTION}>新增大类</option>
                  </select>
                </label>

                {planDraft.majorMode === NEW_OPTION && (
                  <label className="dialog-field">
                    <span>新大类名称</span>
                    <input
                      type="text"
                      value={planDraft.majorInput}
                      onChange={(event) => setPlanDraft((current) => ({ ...current, majorInput: event.target.value }))}
                      placeholder="例如：学习 / 工作 / 个人项目"
                    />
                  </label>
                )}

                <label className="dialog-field">
                  <span>计划小类</span>
                  <select
                    value={planDraft.minorMode === NEW_OPTION ? NEW_OPTION : planDraft.minorSelect}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPlanDraft((current) => ({
                        ...current,
                        minorMode: value === NEW_OPTION ? NEW_OPTION : "existing",
                        minorSelect: value === NEW_OPTION ? NEW_OPTION : value,
                        minorInput: ""
                      }));
                    }}
                  >
                    {planMinorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_OPTION}>新增小类</option>
                  </select>
                </label>

                {planDraft.minorMode === NEW_OPTION && (
                  <label className="dialog-field">
                    <span>新小类名称</span>
                    <input
                      type="text"
                      value={planDraft.minorInput}
                      onChange={(event) => setPlanDraft((current) => ({ ...current, minorInput: event.target.value }))}
                      placeholder="例如：网站升级 / 论文整理 / 发版"
                    />
                  </label>
                )}

                <label className="dialog-field wide">
                  <span>计划名称</span>
                  <input
                    type="text"
                    value={planDraft.taskName}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, taskName: event.target.value }))}
                    placeholder="写一个清晰的计划名称"
                  />
                </label>

                <label className="dialog-field">
                  <span>起始日期</span>
                  <input
                    type="date"
                    value={planDraft.startDate}
                    onChange={(event) => syncFirstPlanNodeDate(event.target.value)}
                  />
                </label>

                <label className="dialog-field">
                  <span>期望截止</span>
                  <input
                    type="date"
                    value={planDraft.expectedDueDate}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, expectedDueDate: event.target.value }))}
                  />
                </label>

                {planDraftLatestNode?.status === "done" && (
                  <label className="dialog-field">
                    <span>完成日期</span>
                    <input
                      type="date"
                      value={planDraft.completedAt}
                      onChange={(event) => setPlanDraft((current) => ({ ...current, completedAt: event.target.value }))}
                    />
                  </label>
                )}

                <label className="dialog-field">
                  <span>权限等级</span>
                  <select
                    value={planDraft.permissionLevel}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, permissionLevel: event.target.value }))}
                  >
                    {PERMISSION_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dialog-field color-field">
                  <span>渲染颜色</span>
                  <div className="dialog-color-control">
                    <input
                      type="color"
                      value={planDraft.color}
                      onChange={(event) => setPlanDraft((current) => ({ ...current, color: event.target.value }))}
                    />
                    <strong>{planDraft.color.toUpperCase()}</strong>
                  </div>
                </label>

                <label className="dialog-field wide">
                  <span>备注</span>
                  <textarea
                    rows={4}
                    value={planDraft.note}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="鼠标悬浮时展示的说明信息"
                  />
                </label>

                <section className="plan-node-section">
                  <div className="plan-node-section-head">
                    <div>
                      <strong>计划节点</strong>
                      <p>节点记录计划从某一天开始进入的新状态与进度，最新节点就是当前视图。</p>
                    </div>
                    <button type="button" className="plan-node-add-btn" onClick={addPlanNodeDraft}>
                      新增节点
                    </button>
                  </div>

                  {planDraft.nodes.length ? (
                    <div className="plan-node-list">
                      {planDraft.nodes.map((node, index) => (
                        <div key={node.clientId} className="plan-node-card">
                          <div className="plan-node-card-head">
                            <strong>节点 {index + 1}</strong>
                            <button
                              type="button"
                              className="plan-node-remove-btn"
                              onClick={() => removePlanNodeDraft(node.clientId)}
                            >
                              删除节点
                            </button>
                          </div>

                          <div className="plan-node-grid">
                            <label className="dialog-field wide">
                              <span>节点名称</span>
                              <input
                                type="text"
                                value={node.title}
                                onChange={(event) => updatePlanNodeDraft(node.clientId, { title: event.target.value })}
                                placeholder="例如：完成结构拆分 / 提交第一版"
                              />
                            </label>

                            <label className="dialog-field">
                              <span>节点日期</span>
                              <input
                                type="date"
                                value={node.nodeDate}
                                onChange={(event) => updatePlanNodeDraft(node.clientId, { nodeDate: event.target.value })}
                              />
                            </label>

                            <label className="dialog-field">
                              <span>节点进度</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={node.progressValue}
                                onChange={(event) => updatePlanNodeDraft(node.clientId, { progressValue: event.target.value })}
                              />
                            </label>

                            <label className="dialog-field">
                              <span>节点状态</span>
                              <select
                                value={node.status}
                                onChange={(event) => updatePlanNodeDraft(node.clientId, { status: event.target.value })}
                              >
                                {PLAN_STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="dialog-field wide">
                              <span>节点备注</span>
                              <textarea
                                rows={3}
                                value={node.note}
                                onChange={(event) => updatePlanNodeDraft(node.clientId, { note: event.target.value })}
                                placeholder="记录这个节点对应的说明"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="plan-node-empty">当前还没有节点，可以在这里补充阶段里程碑。</div>
                  )}
                </section>
              </div>
            ) : null}

            {dialogError ? <div className="dialog-error">{dialogError}</div> : null}

            <div className="dialog-actions">
              {(activeDialog === "event-edit" || activeDialog === "plan-edit") && (
                <button
                  type="button"
                  className="dialog-btn danger"
                  onClick={() => deleteCurrentRecord(activeDialog.startsWith("plan") ? "plan" : "event")}
                  disabled={isSubmitting}
                >
                  删除
                </button>
              )}
              <button type="button" className="dialog-btn secondary" onClick={closeDialog} disabled={isSubmitting}>
                取消
              </button>
              {isEventDialog && (
                <button
                  type="button"
                  className="dialog-btn primary"
                  onClick={activeDialog === "event-create" ? submitEventDraft : submitEventEdit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "提交中…" : activeDialog === "event-create" ? "确认新增" : "保存修改"}
                </button>
              )}
              {isPlanDialog && (
                <button
                  type="button"
                  className="dialog-btn primary"
                  onClick={activeDialog === "plan-create" ? submitPlanDraft : submitPlanEdit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "提交中…" : activeDialog === "plan-create" ? "确认新增" : "保存修改"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .lepid-eye-shell {
          min-height: 100vh;
          color: var(--text);
          background: var(--bg);
          position: relative;
          overflow-x: hidden;
          font-family: inherit;
          --bg-1: #020303;
          --bg-2: #0a0d0f;
          --bg: linear-gradient(135deg, var(--bg-1), var(--bg-2));
          --bg-soft: rgba(255, 255, 255, 0.04);
          --panel: rgba(7, 11, 14, 0.74);
          --panel-strong: rgba(11, 18, 22, 0.9);
          --border: rgba(255, 255, 255, 0.12);
          --text: #f4f7fb;
          --muted: rgba(244, 247, 251, 0.6);
          --line: rgba(255, 255, 255, 0.06);
          --past: rgba(255, 255, 255, 0.14);
          --future: rgba(255, 255, 255, 0.04);
          --current: rgba(163, 211, 255, 0.28);
          --current-line: rgba(163, 211, 255, 0.76);
          --track: rgba(255, 255, 255, 0.12);
          --shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        }

        .lepid-eye-shell.light {
          --bg-1: #7f8fb2;
          --bg-2: #c1cadf;
          --bg: linear-gradient(135deg, var(--bg-1), var(--bg-2));
          --bg-soft: rgba(18, 25, 40, 0.08);
          --panel: rgba(227, 233, 247, 0.5);
          --panel-strong: rgba(238, 243, 252, 0.78);
          --border: rgba(30, 38, 56, 0.12);
          --text: #102033;
          --muted: rgba(16, 32, 51, 0.58);
          --line: rgba(30, 38, 56, 0.08);
          --past: rgba(31, 45, 69, 0.18);
          --future: rgba(31, 45, 69, 0.06);
          --current: rgba(125, 177, 255, 0.2);
          --current-line: rgba(69, 125, 209, 0.72);
          --track: rgba(31, 45, 69, 0.16);
          --shadow: 0 24px 60px rgba(44, 58, 92, 0.16);
        }

        .butterfly-canvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
          animation: butterflyCanvasGlow 3.8s ease-in-out infinite;
          transition: filter 1.15s ease, opacity 1.15s ease;
          opacity: 0.96;
          filter: brightness(1.14) saturate(1.08) drop-shadow(0 0 20px rgba(255, 255, 255, 0.18));
        }

        @keyframes butterflyCanvasGlow {
          0%,
          100% {
            filter: brightness(1.02) saturate(1.02) drop-shadow(0 0 10px rgba(255, 255, 255, 0.12));
          }

          45% {
            filter: brightness(1.16) saturate(1.08) drop-shadow(0 0 22px rgba(255, 255, 255, 0.22));
          }

          70% {
            filter: brightness(1.12) saturate(1.06) drop-shadow(0 0 18px rgba(255, 255, 255, 0.2));
          }
        }

        .theme-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .day-gradient,
        .night-gradient {
          position: absolute;
          inset: 0;
          transition: opacity 1.2s ease-in-out, transform 1.2s ease-in-out, filter 1.2s ease-in-out;
          background-size: 200% 200%;
          animation: gradientFlow 15s ease infinite;
        }

        .day-gradient {
          background: linear-gradient(140deg, #8093b8 0%, #6d7ea8 26%, #a9b8d6 62%, #d3dced 100%);
        }

        .night-gradient {
          background: linear-gradient(140deg, #09131f 0%, #060b14 32%, #111d31 68%, #04070f 100%);
        }

        @keyframes gradientFlow {
          0% {
            background-position: 10% 10%;
          }

          50% {
            background-position: 80% 80%;
          }

          100% {
            background-position: 10% 10%;
          }
        }

        .background-layer {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.08), transparent 24%),
            radial-gradient(circle at 82% 22%, rgba(255, 255, 255, 0.04), transparent 28%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 36%);
          pointer-events: none;
        }

        .lepid-eye-shell.light .background-layer {
          background:
            radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.22), transparent 22%),
            radial-gradient(circle at 82% 16%, rgba(233, 239, 255, 0.18), transparent 24%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 38%);
        }

        .page-body {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 36px));
          margin: 0 auto;
          padding: 96px 0 28px;
          transition: color 1.1s ease, opacity 0.9s ease, transform 0.9s ease, filter 0.9s ease;
        }

        .grid-layout {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .panel {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--border);
          background: linear-gradient(160deg, var(--panel-strong), var(--panel));
          border-radius: 26px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          min-width: 0;
          transition:
            background 1.1s ease,
            border-color 1.1s ease,
            box-shadow 1.1s ease,
            color 1.1s ease,
            transform 0.7s ease;
        }

        .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 30%),
            linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.04) 55%, transparent 100%);
          pointer-events: none;
        }

        .doc-panel {
          padding: 18px 18px 20px;
        }

        .doc-intro {
          display: grid;
          gap: 10px;
        }

        .doc-intro p {
          margin: 0;
          color: var(--muted);
          line-height: 1.8;
          font-size: 14px;
        }

        .viewer-badge {
          position: absolute;
          top: -14px;
          left: calc(22px + ((100% - 44px) / 2));
          transform: translateX(-50%);
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          max-width: min(calc(100% - 64px), 220px);
          min-width: 128px;
          padding: 6px 12px 7px;
          border-radius: 999px;
          border: 1px solid rgba(186, 222, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02)),
            linear-gradient(90deg, rgba(133, 162, 202, 0.18), rgba(186, 222, 255, 0.16), rgba(133, 162, 202, 0.12));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 6px 14px rgba(0, 0, 0, 0.12);
        }

        .light .viewer-badge {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03)),
            linear-gradient(90deg, rgba(109, 138, 179, 0.2), rgba(186, 222, 255, 0.18), rgba(109, 138, 179, 0.14));
        }

        .viewer-badge-label {
          color: var(--muted);
          font-size: 10px;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .viewer-badge strong {
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .access-banner {
          position: relative;
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) 22px;
          align-items: center;
          gap: 8px;
          margin-top: 34px;
          margin-bottom: 14px;
          padding-top: 20px;
        }

        .access-arrow {
          position: relative;
          display: block;
          width: 22px;
          height: 22px;
          opacity: 0.82;
        }

        .access-arrow::before {
          content: "";
          position: absolute;
          inset: 5px;
          border-top: 2px solid rgba(220, 236, 255, 0.82);
          border-right: 2px solid rgba(220, 236, 255, 0.82);
          box-shadow: 0 0 12px rgba(186, 222, 255, 0.14);
        }

        .access-arrow.left::before {
          transform: rotate(45deg);
        }

        .access-arrow.right::before {
          transform: rotate(-135deg);
        }

        .access-core {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 16px;
          border-radius: 20px;
          border: 1px solid rgba(186, 222, 255, 0.18);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(90deg, rgba(142, 174, 216, 0.16), rgba(186, 222, 255, 0.26), rgba(149, 181, 220, 0.14));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 10px 22px rgba(0, 0, 0, 0.1);
        }

        .access-caption {
          color: var(--muted);
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .access-level {
          color: var(--text);
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .access-matrix {
          border: 1px solid var(--border);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }

        .admin-actions-card {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .admin-action-btn {
          min-height: 58px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(186, 222, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, rgba(117, 148, 191, 0.18), rgba(186, 222, 255, 0.14));
          color: var(--text);
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-align: left;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 20px rgba(0, 0, 0, 0.08);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          cursor: pointer;
        }

        .admin-action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 12px 24px rgba(0, 0, 0, 0.12);
        }

        .admin-action-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
          filter: saturate(0.82);
          transform: none;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 8px 16px rgba(0, 0, 0, 0.08);
        }

        .admin-action-btn.event-create {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, rgba(157, 210, 255, 0.24), rgba(92, 155, 222, 0.18));
        }

        .admin-action-btn.event-edit {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, rgba(191, 201, 219, 0.18), rgba(149, 161, 184, 0.12));
        }

        .admin-action-btn.plan-create {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, rgba(179, 230, 214, 0.22), rgba(116, 176, 176, 0.18));
        }

        .admin-action-btn.plan-edit {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, rgba(229, 206, 170, 0.2), rgba(193, 157, 112, 0.14));
        }

        .access-row {
          display: grid;
          grid-template-columns: 102px minmax(0, 1fr);
          gap: 12px;
          padding: 10px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .access-row:first-child {
          border-top: none;
        }

        .access-row span:last-child {
          color: var(--text);
        }

        .access-head {
          background: rgba(186, 222, 255, 0.06);
          color: var(--text);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        .eyebrow::before {
          content: "";
          width: 18px;
          height: 1px;
          background: currentColor;
          opacity: 0.7;
        }

        .doc-title {
          margin: 18px 0 14px;
          font-size: 34px;
          line-height: 1.04;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .timeline-panel,
        .plan-panel,
        .stats-panel,
        .ai-panel {
          padding: 16px;
        }

        .timeline-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .timeline-scroll.compact {
          flex: 1;
          min-height: 0;
          max-height: none;
        }

        .plan-panel,
        .bottom-row {
          grid-column: 1 / span 2;
        }

        .bottom-row {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
          gap: 14px;
        }

        .panel h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .panel-head span {
          font-size: 0.8rem;
          color: var(--muted);
          letter-spacing: 0.12em;
        }

        .panel-controls {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        .category-filter {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 0.74rem;
          letter-spacing: 0.08em;
        }

        .category-filter select {
          height: 32px;
          min-width: 122px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          font: inherit;
          outline: none;
        }

        .inline-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 0.74rem;
          letter-spacing: 0.06em;
          user-select: none;
        }

        .inline-toggle input {
          width: 16px;
          height: 16px;
          accent-color: rgba(186, 222, 255, 0.94);
        }

        .scale-switch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .scale-btn {
          height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.04);
          color: var(--muted);
          font: inherit;
          font-size: 11px;
          letter-spacing: 0.12em;
          cursor: pointer;
          transition: all 0.24s ease;
        }

        .scale-btn.active {
          color: var(--text);
          border-color: rgba(186, 222, 255, 0.4);
          background: rgba(186, 222, 255, 0.14);
          box-shadow: 0 0 14px rgba(186, 222, 255, 0.16);
        }

        .timeline-scroll,
        .plan-scroll {
          overflow: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }

        .timeline-scroll::-webkit-scrollbar,
        .plan-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .timeline-scroll::-webkit-scrollbar-thumb,
        .plan-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 999px;
        }

        .timeline-header,
        .timeline-grid,
        .plan-header,
        .plan-row {
          display: grid;
          width: max-content;
        }

        .timeline-grid {
          position: relative;
        }

        .timeline-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: linear-gradient(180deg, var(--panel-strong), color-mix(in srgb, var(--panel-strong) 82%, transparent 18%));
          backdrop-filter: blur(12px);
        }

        .timeline-head-side,
        .timeline-hour,
        .plan-side-head,
        .plan-label {
          position: sticky;
          left: 0;
          z-index: 12;
          background: var(--panel-strong);
        }

        .timeline-head-side,
        .timeline-day-head,
        .plan-side-head,
        .plan-day-head {
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--line);
          border-right: 1px solid var(--line);
          color: var(--muted);
          font-size: 0.82rem;
          white-space: nowrap;
        }

        .plan-side-head,
        .plan-day-head {
          height: 56px;
          align-items: flex-end;
          padding-bottom: 12px;
        }

        .timeline-head-side {
          z-index: 10;
        }

        .timeline-day-head.today,
        .plan-day-head.today {
          color: #badeff;
          background: rgba(186, 222, 255, 0.08);
        }

        .timeline-hour {
          height: ${timelineRowHeight}px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          color: var(--muted);
          font-size: 0.7rem;
        }

        .timeline-cell {
          position: relative;
          height: ${timelineRowHeight}px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          background: var(--future);
        }

        .timeline-cell.past {
          background: var(--past);
        }

        .timeline-cell.today {
          background: rgba(163, 211, 255, 0.16);
        }

        .timeline-cell.current {
          background: rgba(163, 211, 255, 0.26);
        }

        .timeline-cell.current::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(186, 222, 255, 0.32), transparent 72%);
          animation: currentTimePulse 1.8s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes currentTimePulse {
          0%,
          100% {
            opacity: 0.38;
            filter: brightness(1);
          }

          50% {
            opacity: 0.9;
            filter: brightness(1.12);
          }
        }

        .timeline-task {
          position: absolute;
          left: 4px;
          right: 4px;
          box-sizing: border-box;
          border-radius: 12px;
          padding: 2px 6px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          overflow: hidden;
          color: var(--text);
          background: color-mix(in srgb, var(--event-color) 82%, white 18%);
          border: 1px solid rgba(255, 255, 255, 0.16);
          text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.82),
            0 0 12px rgba(0, 0, 0, 0.3);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 6px 16px rgba(0, 0, 0, 0.12);
          opacity: var(--event-opacity, 0.88);
          transform-origin: center;
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .timeline-overlap-marker {
          position: absolute;
          left: 6px;
          right: 6px;
          border-radius: 999px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
            repeating-linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.28) 0px,
              rgba(255, 255, 255, 0.28) 8px,
              rgba(20, 28, 42, 0.12) 8px,
              rgba(20, 28, 42, 0.12) 16px
            );
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.18),
            0 0 10px rgba(186, 222, 255, 0.12);
          opacity: 0.7;
          z-index: 5;
        }

        .timeline-overlap-marker.strong {
          opacity: 0.92;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.26),
            0 0 14px rgba(255, 170, 170, 0.18);
        }

        .timeline-event-layer {
          position: absolute;
          top: 0;
          pointer-events: none;
          z-index: 4;
          overflow: hidden;
        }

        .timeline-day-overlay {
          position: absolute;
          top: 0;
          width: ${timelineDayWidth}px;
          height: 100%;
          pointer-events: none;
        }

        .timeline-day-overlay .timeline-task,
        .timeline-day-overlay .timeline-repeat-fill,
        .timeline-day-overlay .timeline-overlap-marker {
          pointer-events: auto;
        }

        .timeline-task.nested {
          left: 12px;
          right: 12px;
          border-color: rgba(255, 255, 255, 0.34);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 10px 22px rgba(0, 0, 0, 0.18),
            0 0 18px rgba(186, 222, 255, 0.12);
        }

        .timeline-task-text {
          display: block;
          width: 100%;
          text-align: center;
          white-space: nowrap;
          transform-origin: center;
          line-height: 1;
          pointer-events: none;
        }

        .light .timeline-cell.today {
          background: rgba(125, 177, 255, 0.22);
        }

        .light .timeline-cell.current {
          background: rgba(125, 177, 255, 0.34);
        }

        .light .timeline-cell.current::after {
          background: radial-gradient(circle at center, rgba(97, 163, 255, 0.34), transparent 68%);
          opacity: 0.88;
        }

        .timeline-task.focus {
          border-color: rgba(255, 255, 255, 0.28);
        }

        .timeline-task.mix {
          border-color: rgba(186, 222, 255, 0.34);
        }

        .timeline-repeat-fill {
          position: absolute;
          left: 0;
          right: 0;
          background: color-mix(in srgb, var(--event-color) 72%, transparent 28%);
          opacity: var(--event-opacity, 0.45);
          pointer-events: auto;
          transition: box-shadow 0.18s ease, filter 0.18s ease;
        }

        .timeline-repeat-label {
          position: absolute;
          inset: 4px 6px auto 6px;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: var(--text);
          text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.82),
            0 0 10px rgba(0, 0, 0, 0.3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }

        .light .timeline-task {
          color: #0f2033;
          border-color: rgba(70, 96, 142, 0.24);
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.34);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.42),
            0 4px 12px rgba(53, 73, 108, 0.12);
          filter: saturate(1.08) brightness(0.98);
        }

        .light .timeline-overlap-marker {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.08)),
            repeating-linear-gradient(
              135deg,
              rgba(96, 132, 189, 0.22) 0px,
              rgba(96, 132, 189, 0.22) 8px,
              rgba(255, 255, 255, 0.08) 8px,
              rgba(255, 255, 255, 0.08) 16px
            );
          box-shadow:
            inset 0 0 0 1px rgba(70, 96, 142, 0.14),
            0 0 10px rgba(125, 177, 255, 0.14);
        }

        .light .timeline-repeat-fill {
          box-shadow: inset 0 0 0 1px rgba(70, 96, 142, 0.14);
        }

        .light .timeline-task.nested {
          border-color: rgba(70, 96, 142, 0.32);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            0 8px 18px rgba(57, 78, 117, 0.14),
            0 0 16px rgba(125, 177, 255, 0.12);
        }

        .light .timeline-repeat-label {
          color: #102033;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.42);
        }

        .timeline-task:hover {
          transform: scale(1.03);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 10px 24px rgba(0, 0, 0, 0.22),
            0 0 16px rgba(186, 222, 255, 0.16);
          filter: brightness(1.06);
        }

        .timeline-repeat-fill:hover {
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
          filter: brightness(1.12);
        }

        .light .timeline-task:hover {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.46),
            0 8px 18px rgba(57, 78, 117, 0.16),
            0 0 12px rgba(125, 177, 255, 0.16);
          filter: saturate(1.1) brightness(0.96);
        }

        .light .timeline-repeat-fill:hover {
          box-shadow:
            inset 0 0 0 1px rgba(70, 96, 142, 0.24),
            0 0 12px rgba(125, 177, 255, 0.16);
          filter: brightness(1.06);
        }

        .plan-body {
          position: relative;
          width: max-content;
          margin-top: 6px;
        }

        .today-column-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--current-line);
          box-shadow: 0 0 12px rgba(163, 211, 255, 0.38);
          z-index: 1;
          pointer-events: none;
        }

        .plan-label {
          min-height: 52px;
          margin: 0 8px 4px 0;
          padding: 10px 14px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid transparent;
          display: flex;
          flex-direction: column;
          justify-content: center;
          z-index: 4;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
          box-shadow:
            14px 0 24px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, filter 0.18s ease;
        }

        .plan-label.active {
          border-color: color-mix(in srgb, var(--plan-color) 58%, rgba(255, 255, 255, 0.18) 42%);
          background:
            linear-gradient(160deg, color-mix(in srgb, var(--plan-color) 14%, rgba(255, 255, 255, 0.06) 86%), rgba(255, 255, 255, 0.02)),
            linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        }

        .plan-label.primary {
          border-color: color-mix(in srgb, var(--plan-color) 72%, rgba(255, 255, 255, 0.22) 28%);
          background:
            linear-gradient(160deg, color-mix(in srgb, var(--plan-color) 18%, rgba(255, 255, 255, 0.08) 82%), rgba(255, 255, 255, 0.03)),
            linear-gradient(160deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
          box-shadow:
            14px 0 24px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 0 1px color-mix(in srgb, var(--plan-color) 28%, transparent 72%),
            0 0 24px color-mix(in srgb, var(--plan-color) 22%, transparent 78%);
        }

        .plan-label strong {
          font-size: 0.9rem;
          line-height: 1.35;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .plan-label span {
          font-size: 0.74rem;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.45;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .plan-track {
          position: relative;
          min-height: 52px;
          border-bottom: 1px solid var(--line);
          background-image: linear-gradient(90deg, var(--line) 1px, transparent 1px);
          display: flex;
          align-items: center;
        }

        .plan-due-cell {
          position: absolute;
          top: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255, 126, 126, 0.14), rgba(255, 94, 94, 0.06));
          box-shadow:
            inset 0 0 0 1px rgba(255, 126, 126, 0.18),
            0 0 18px rgba(255, 96, 96, 0.08);
          pointer-events: none;
        }

        .plan-bar {
          position: absolute;
          top: 50%;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: var(--plan-segment-fill);
          z-index: 2;
          transform: translateY(-50%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.02);
        }

        .plan-bar.primary {
          opacity: 1;
        }

        .plan-bar.active {
          opacity: 0.92;
          border-color: rgba(255, 255, 255, 0.22);
        }

        .plan-bar.inactive {
          border: 1px dashed rgba(255, 255, 255, 0.42);
          background: transparent;
          box-shadow: none;
          opacity: 0.78;
        }

        .plan-bar.done {
          opacity: 0.78;
        }

        .plan-node {
          position: absolute;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.88);
          background: color-mix(in srgb, var(--plan-color) 34%, var(--panel-strong) 66%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            0 4px 10px rgba(0, 0, 0, 0.16);
          z-index: 3;
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          margin-top: -9px;
        }

        .plan-label:hover,
        .plan-node:hover {
          filter: brightness(1.08);
        }

        .plan-label:hover {
          transform: translateY(-1px);
          box-shadow:
            16px 0 26px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 18px rgba(186, 222, 255, 0.12);
        }

        .plan-node:hover {
          transform: scale(1.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            0 0 16px rgba(186, 222, 255, 0.16),
            0 6px 18px rgba(0, 0, 0, 0.18);
        }

        .stats-content {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
          gap: 18px;
          align-items: stretch;
        }

        .pie-block,
        .stat-list,
        .ai-placeholder {
          border: 1px solid var(--border);
          background: var(--bg-soft);
          border-radius: 18px;
        }

        .pie-block {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          padding: 16px;
        }

        .pie-tilt {
          position: relative;
          width: 248px;
          height: 220px;
          justify-self: center;
        }

        .pie-svg {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
        }

        .pie-floor-shadow {
          fill: rgba(0, 0, 0, 0.2);
          filter: blur(12px);
        }

        .light .pie-floor-shadow {
          fill: rgba(75, 95, 135, 0.16);
        }

        .pie-side-wall {
          filter: saturate(0.94) brightness(0.92);
        }

        .pie-inner-wall {
          opacity: 0.92;
        }

        .pie-top-segment {
          stroke: rgba(255, 255, 255, 0.08);
          stroke-width: 1;
        }

        .light .pie-top-segment {
          stroke: rgba(255, 255, 255, 0.28);
        }

        .pie-top-sheen {
          opacity: 0.58;
          mix-blend-mode: screen;
        }

        .pie-core-disc {
          filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.16));
        }

        .light .pie-core-disc {
          filter: drop-shadow(0 8px 16px rgba(75, 95, 135, 0.12));
        }

        .pie-core-label {
          fill: var(--text);
          font-size: 0.95rem;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .pie-list {
          display: grid;
          gap: 10px;
        }

        .pie-item,
        .stat-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--muted);
        }

        .pie-item strong,
        .stat-card strong {
          color: var(--text);
          font-size: 1rem;
        }

        .pie-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.22);
        }

        .stat-list {
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .stat-card {
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
        }

        .ai-panel {
          display: flex;
          flex-direction: column;
        }

        .ai-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          color: var(--muted);
          font-size: 1rem;
          letter-spacing: 0.12em;
        }

        .lepid-eye-tooltip {
          position: fixed;
          z-index: 60;
          width: min(280px, calc(100vw - 32px));
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: linear-gradient(160deg, var(--panel-strong), var(--panel));
          color: var(--muted);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(18px);
          pointer-events: none;
          font-size: 0.78rem;
          line-height: 1.55;
          transform: translateY(-18px);
        }

        .lepid-eye-tooltip {
          pointer-events: auto;
        }

        .lepid-eye-tooltip strong {
          display: block;
          margin-bottom: 8px;
          color: var(--text);
          font-size: 0.88rem;
        }

        .tooltip-edit-btn {
          margin-top: 10px;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(186, 222, 255, 0.16);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease;
        }

        .tooltip-edit-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .lepid-eye-dialog-root {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }

        .lepid-eye-dialog-backdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 20%, rgba(186, 222, 255, 0.12), transparent 30%),
            rgba(3, 5, 9, 0.54);
          backdrop-filter: blur(10px);
          animation: dialogBackdropIn 0.22s ease;
        }

        .lepid-eye-dialog {
          position: relative;
          width: min(760px, calc(100vw - 24px));
          max-height: min(86vh, 920px);
          overflow: auto;
          padding: 20px 20px 18px;
          border-radius: 28px;
          border: 1px solid rgba(186, 222, 255, 0.14);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
            linear-gradient(160deg, var(--panel-strong), var(--panel));
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(26px);
          animation: dialogIn 0.26s ease;
        }

        .light .lepid-eye-dialog-backdrop {
          background:
            radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.12), transparent 28%),
            rgba(88, 103, 136, 0.42);
        }

        .light .lepid-eye-dialog {
          background:
            linear-gradient(180deg, rgba(247, 250, 255, 0.985), rgba(238, 243, 252, 0.975)),
            linear-gradient(160deg, rgba(245, 249, 255, 0.985), rgba(232, 238, 249, 0.975));
          border-color: rgba(66, 91, 135, 0.18);
          box-shadow: 0 32px 84px rgba(49, 66, 102, 0.24);
        }

        .dialog-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .dialog-head h3 {
          margin: 8px 0 0;
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: 0.05em;
        }

        .dialog-eyebrow {
          color: var(--muted);
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .dialog-close {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(186, 222, 255, 0.14);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }

        .dialog-close:hover {
          transform: scale(1.03);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(186, 222, 255, 0.24);
        }

        .dialog-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 12px;
        }

        .dialog-summary {
          grid-column: 1 / -1;
          padding: 10px 14px;
          border-radius: 18px;
          border: 1px solid rgba(186, 222, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .dialog-summary summary {
          cursor: pointer;
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        .dialog-summary-grid {
          display: grid;
          gap: 6px;
          margin-top: 10px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .dialog-field {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .dialog-field.inline {
          grid-template-columns: auto minmax(160px, 1fr);
          align-items: center;
          gap: 10px;
        }

        .dialog-field.inline span {
          margin: 0;
        }

        .dialog-field.wide {
          grid-column: 1 / -1;
        }

        .dialog-field span {
          color: var(--muted);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .dialog-field input,
        .dialog-field select,
        .dialog-field textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(186, 222, 255, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
          font: inherit;
          font-size: 14px;
          padding: 12px 14px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        .dialog-field input:focus,
        .dialog-field select:focus,
        .dialog-field textarea:focus {
          border-color: rgba(186, 222, 255, 0.36);
          box-shadow: 0 0 0 1px rgba(186, 222, 255, 0.18), 0 0 18px rgba(186, 222, 255, 0.08);
          background: rgba(255, 255, 255, 0.08);
        }

        .dialog-field textarea {
          resize: vertical;
          min-height: 110px;
        }

        .light .dialog-field input,
        .light .dialog-field select,
        .light .dialog-field textarea,
        .light .dialog-color-control {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(66, 91, 135, 0.16);
        }

        .light .dialog-summary,
        .light .selector-record,
        .light .selector-add-filter select,
        .light .selector-filter-row input,
        .light .selector-filter-row select {
          background: rgba(255, 255, 255, 0.86);
          border-color: rgba(66, 91, 135, 0.14);
        }

        .dialog-color-control {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 8px 12px;
          border: 1px solid rgba(186, 222, 255, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.05);
        }

        .dialog-color-control input[type="color"] {
          width: 44px;
          height: 32px;
          padding: 0;
          border: none;
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
        }

        .dialog-color-control strong {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: var(--text);
        }

        .plan-node-section {
          grid-column: 1 / -1;
          display: grid;
          gap: 14px;
          padding-top: 8px;
          border-top: 1px solid var(--line);
        }

        .plan-node-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .plan-node-section-head strong {
          display: block;
          font-size: 14px;
          letter-spacing: 0.04em;
        }

        .plan-node-section-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .plan-node-add-btn,
        .plan-node-remove-btn {
          border: 1px solid rgba(186, 222, 255, 0.18);
          background: rgba(186, 222, 255, 0.08);
          color: var(--text);
          border-radius: 999px;
          padding: 8px 14px;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease;
        }

        .plan-node-remove-btn {
          background: rgba(255, 122, 122, 0.08);
          border-color: rgba(255, 122, 122, 0.18);
        }

        .plan-node-add-btn:hover,
        .plan-node-remove-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .plan-node-list {
          display: grid;
          gap: 12px;
        }

        .plan-node-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .plan-node-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .plan-node-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .plan-node-empty {
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .dialog-error {
          margin-top: 14px;
          padding: 11px 14px;
          border-radius: 16px;
          border: 1px solid rgba(255, 144, 144, 0.18);
          background: rgba(170, 43, 43, 0.12);
          color: #ffd8d8;
          font-size: 13px;
          line-height: 1.6;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 18px;
        }

        .dialog-btn {
          min-width: 108px;
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(186, 222, 255, 0.16);
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease;
        }

        .dialog-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .dialog-btn:disabled {
          cursor: wait;
          opacity: 0.7;
          transform: none;
        }

        .dialog-btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          color: var(--muted);
        }

        .dialog-btn.compact {
          min-width: 0;
          height: 36px;
          padding: 0 14px;
        }

        .dialog-btn.primary {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
            linear-gradient(90deg, rgba(142, 174, 216, 0.18), rgba(186, 222, 255, 0.28), rgba(149, 181, 220, 0.18));
          color: var(--text);
        }

        .dialog-btn.danger {
          margin-right: auto;
          background: rgba(178, 54, 54, 0.16);
          border-color: rgba(255, 156, 156, 0.18);
          color: #ffdede;
        }

        .light .plan-node-card,
        .light .plan-node-empty {
          background: rgba(255, 255, 255, 0.82);
          border-color: rgba(66, 91, 135, 0.12);
        }

        .selector-toolbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .selector-add-filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .selector-add-filter select,
        .selector-filter-row input,
        .selector-filter-row select {
          min-width: 0;
          height: 38px;
          padding: 0 12px;
          border-radius: 14px;
          border: 1px solid rgba(186, 222, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
          font: inherit;
        }

        .selector-filters {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
        }

        .selector-filter-row {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }

        .selector-filter-label {
          color: var(--muted);
          font-size: 12px;
          letter-spacing: 0.08em;
        }

        .selector-filter-remove {
          height: 34px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(186, 222, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: var(--muted);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .selector-list {
          display: grid;
          gap: 10px;
          max-height: min(56vh, 520px);
          overflow: auto;
          padding-right: 4px;
        }

        .selector-group {
          display: grid;
          gap: 8px;
        }

        .selector-group-head {
          display: grid;
          gap: 8px;
        }

        .selector-group-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 16px;
          border: 1px solid rgba(186, 222, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
        }

        .selector-group-toggle strong {
          color: var(--muted);
          font-size: 12px;
        }

        .selector-group-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px 0 4px;
          color: var(--muted);
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .selector-group-check input {
          width: 15px;
          height: 15px;
          accent-color: #badeff;
        }

        .selector-group-body {
          display: grid;
          gap: 10px;
          padding-left: 4px;
        }

        .selector-group-empty {
          padding: 10px 14px;
          color: var(--muted);
          font-size: 12px;
        }

        .selector-record {
          display: grid;
          gap: 8px;
          width: 100%;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(186, 222, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          text-align: left;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .selector-record:hover {
          transform: translateY(-1px);
          border-color: rgba(186, 222, 255, 0.22);
          background: rgba(255, 255, 255, 0.06);
        }

        .selector-record-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .selector-record-head strong {
          color: var(--text);
          font-size: 15px;
        }

        .selector-record-head span,
        .selector-record-meta span,
        .selector-empty {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .selector-record-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
        }

        .selector-empty {
          padding: 24px 12px;
          text-align: center;
        }

        @keyframes dialogBackdropIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes dialogIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 960px) {
          .grid-layout {
            grid-template-columns: 1fr;
          }

          .plan-panel,
          .bottom-row {
            grid-column: auto;
          }

          .bottom-row,
          .stats-content {
            grid-template-columns: 1fr;
          }

          .pie-block {
            grid-template-columns: 1fr;
          }

          .admin-actions-card {
            grid-template-columns: 1fr;
          }

          .dialog-form {
            grid-template-columns: 1fr;
          }

          .selector-toolbar,
          .selector-add-filter,
          .selector-group-head,
          .selector-record-head,
          .selector-record-meta {
            display: grid;
          }

          .selector-group-check {
            padding-left: 8px;
          }

          .selector-filter-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .page-body {
            width: min(100%, calc(100% - 16px));
            padding-top: 78px;
            padding-bottom: 20px;
          }

          .panel {
            border-radius: 20px;
          }

          .doc-title {
            font-size: 30px;
          }

          .doc-panel,
          .timeline-panel,
          .plan-panel,
          .stats-panel,
          .ai-panel {
            padding: 16px;
          }

          .access-banner {
            padding-top: 18px;
          }

          .viewer-badge {
            max-width: calc(100% - 64px);
          }

          .lepid-eye-dialog {
            padding: 18px 16px 16px;
            border-radius: 24px;
          }

          .dialog-head h3 {
            font-size: 24px;
          }

          .dialog-actions {
            flex-direction: column-reverse;
          }

          .plan-node-section-head,
          .plan-node-card-head {
            flex-direction: column;
            align-items: stretch;
          }

          .plan-node-grid {
            grid-template-columns: 1fr;
          }

          .dialog-btn {
            width: 100%;
          }

          .pie-tilt {
            width: min(248px, 100%);
            height: auto;
          }

          .panel-head {
            align-items: flex-start;
            gap: 10px;
          }

          .panel-controls {
            justify-content: flex-start;
          }

          .timeline-scroll,
          .plan-scroll {
            margin: 0 -4px;
            padding: 0 4px 4px;
          }
        }
      `}</style>
    </main>
  );
}

function FragmentRow({ hour, days, currentHour }) {
  return (
    <>
      <div className="timeline-hour">{String(hour).padStart(2, "0")}:00</div>
      {days.map((day, dayIndex) => {
        const isPast = day.offset < 0 || (day.offset === 0 && hour < currentHour);
        const isToday = day.offset === 0;
        const isCurrent = day.offset === 0 && hour === currentHour;

        return (
          <div
            key={`${day.key}-${hour}`}
            className={`timeline-cell ${isPast ? "past" : ""} ${isToday ? "today" : ""} ${isCurrent ? "current" : ""}`}
          />
        );
      })}
    </>
  );
}

function TimelineDayColumn({ day, dayIndex, taskRows, isCreator, onHover, onHoverMove, onHoverEnd }) {
  const dayTasks = taskRows.filter((item) => item.dayIndex === dayIndex);
  const timelineCards = buildTimelineEventCards(dayTasks);
  const overlapMarkers = buildTimelineOverlapMarkers(dayTasks);

  return (
    <div className={`timeline-day-overlay ${day.isToday ? "today" : ""}`} style={{ left: `${dayIndex * timelineDayWidth}px` }}>
      {timelineCards.map((task) => {
        const taskHoverDetail = {
          type: "event",
          title: task.label,
          lines: [
            `事务分类：${task.majorCategory} · ${task.minorCategory}`,
            `起始时间：${task.originalStart}`,
            task.originalEnd ? `结束时间：${task.originalEnd}` : null,
            task.note || "无备注"
          ].filter(Boolean),
          editTarget:
            isCreator
              ? { entity: "event", id: task.sourceId }
              : null
        };

        return (
          <div
            key={task.id}
            className={`timeline-task ${task.tone ?? "mix"} ${task.isNested ? "nested" : ""}`}
            style={{
              top: `${task.topPx}px`,
              height: `${task.heightPx}px`,
              zIndex: task.zIndex,
              "--event-color": task.color ?? "rgb(186, 222, 255)",
              "--event-opacity": task.eventOpacity
            }}
            onMouseEnter={(event) => onHover(event, taskHoverDetail)}
            onMouseMove={onHoverMove}
            onMouseLeave={onHoverEnd}
          >
            <span
              className="timeline-task-text"
              style={{
                fontSize: `${task.fontSize}px`
              }}
            >
              {task.label}
            </span>
          </div>
        );
      })}
      {overlapMarkers.map((marker) => {
        const overlapHoverDetail = {
          type: "event",
          title: "事务重叠",
          lines: [
            `事务分类：${marker.tasks.map((item) => `${item.majorCategory} · ${item.minorCategory}`).join(" / ")}`,
            ...marker.tasks.flatMap((item) => [
              `起始时间：${item.originalStart}`,
              item.originalEnd ? `结束时间：${item.originalEnd}` : null
            ]).filter(Boolean),
            marker.tasks.map((item) => item.note).filter(Boolean).join(" / ") || "无备注"
          ],
          editTarget: null
        };

        return (
          <div
            key={`${day.key}-${marker.key}`}
            className="timeline-overlap-marker strong"
            style={{
              top: `${marker.topPx}px`,
              height: `${Math.max(4, marker.heightPx)}px`,
              background: marker.background
            }}
            onMouseEnter={(event) => onHover(event, overlapHoverDetail)}
            onMouseMove={onHoverMove}
            onMouseLeave={onHoverEnd}
          />
        );
      })}
    </div>
  );
}
