"use client";

import { useMemo } from "react";

function normalizeAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function polarToEllipse(cx, cy, rx, ry, angle) {
  return {
    x: cx + Math.cos(angle) * rx,
    y: cy + Math.sin(angle) * ry
  };
}

function buildDonutSegmentPath(cx, cy, outerRx, outerRy, innerRx, innerRy, startAngle, endAngle) {
  const outerStart = polarToEllipse(cx, cy, outerRx, outerRy, startAngle);
  const outerEnd = polarToEllipse(cx, cy, outerRx, outerRy, endAngle);
  const innerEnd = polarToEllipse(cx, cy, innerRx, innerRy, endAngle);
  const innerStart = polarToEllipse(cx, cy, innerRx, innerRy, startAngle);
  const delta = normalizeAngle(endAngle - startAngle);
  const largeArcFlag = delta > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRx} ${outerRy} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRx} ${innerRy} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

function intersectAngleRange(startAngle, endAngle, visibleStart, visibleEnd) {
  const totalSpan = normalizeAngle(endAngle - startAngle);
  if (totalSpan === 0) return [];

  let segmentStart = startAngle;
  let segmentEnd = endAngle;
  if (segmentEnd < segmentStart) {
    segmentEnd += Math.PI * 2;
  }

  const windows = [
    [visibleStart, visibleEnd],
    [visibleStart + Math.PI * 2, visibleEnd + Math.PI * 2]
  ];

  return windows
    .map(([windowStart, windowEnd]) => [Math.max(segmentStart, windowStart), Math.min(segmentEnd, windowEnd)])
    .filter(([hitStart, hitEnd]) => hitEnd > hitStart);
}

function buildSideWallPath(cx, cy, rx, ry, depth, startAngle, endAngle) {
  const topStart = polarToEllipse(cx, cy, rx, ry, startAngle);
  const topEnd = polarToEllipse(cx, cy, rx, ry, endAngle);
  const bottomEnd = polarToEllipse(cx, cy + depth, rx, ry, endAngle);
  const bottomStart = polarToEllipse(cx, cy + depth, rx, ry, startAngle);
  const delta = normalizeAngle(endAngle - startAngle);
  const largeArcFlag = delta > Math.PI ? 1 : 0;

  return [
    `M ${topStart.x} ${topStart.y}`,
    `A ${rx} ${ry} 0 ${largeArcFlag} 1 ${topEnd.x} ${topEnd.y}`,
    `L ${bottomEnd.x} ${bottomEnd.y}`,
    `A ${rx} ${ry} 0 ${largeArcFlag} 0 ${bottomStart.x} ${bottomStart.y}`,
    "Z"
  ].join(" ");
}

function buildPieGeometry(segments) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let cursor = -Math.PI / 2;

  return segments.map((segment, index) => {
    const angle = (segment.value / total) * Math.PI * 2;
    const startAngle = cursor;
    const endAngle = cursor + angle;
    cursor = endAngle;

    return {
      ...segment,
      index,
      startAngle,
      endAngle,
      visibleOuterRanges: intersectAngleRange(startAngle, endAngle, 0, Math.PI),
      visibleInnerRanges: intersectAngleRange(startAngle, endAngle, 0, Math.PI)
    };
  });
}

export default function PieDonutCard({ segments, isDarkMode }) {
  const geometry = useMemo(() => buildPieGeometry(segments), [segments]);
  const outerRx = 108;
  const outerRy = 74;
  const innerRx = 58;
  const innerRy = 40;
  const depth = 28;
  const cx = 124;
  const cy = 94;

  const outerWalls = geometry
    .flatMap((segment) =>
      segment.visibleOuterRanges.map(([startAngle, endAngle]) => ({
        key: `outer-${segment.label}-${startAngle}`,
        depthOrder: Math.sin((startAngle + endAngle) / 2),
        fill: `url(#outer-side-${segment.index})`,
        path: buildSideWallPath(cx, cy, outerRx, outerRy, depth, startAngle, endAngle)
      }))
    )
    .sort((a, b) => a.depthOrder - b.depthOrder);

  const innerWalls = geometry
    .flatMap((segment) =>
      segment.visibleInnerRanges.map(([startAngle, endAngle]) => ({
        key: `inner-${segment.label}-${startAngle}`,
        depthOrder: Math.sin((startAngle + endAngle) / 2),
        fill: isDarkMode ? "rgba(8, 12, 18, 0.94)" : "rgba(217, 225, 239, 0.9)",
        path: buildSideWallPath(cx, cy, innerRx, innerRy, depth, startAngle, endAngle)
      }))
    )
    .sort((a, b) => a.depthOrder - b.depthOrder);

  return (
    <div className="pie-tilt">
      <svg className="pie-svg" viewBox="0 0 248 220" aria-label="事务占比饼图" role="img">
        <defs>
          {geometry.map((segment) => (
            <linearGradient key={`top-${segment.index}`} id={`top-segment-${segment.index}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={segment.topStart} />
              <stop offset="55%" stopColor={segment.color} />
              <stop offset="100%" stopColor={segment.topEnd} />
            </linearGradient>
          ))}
          {geometry.map((segment) => (
            <linearGradient key={`side-${segment.index}`} id={`outer-side-${segment.index}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={segment.sideStart} />
              <stop offset="100%" stopColor={segment.sideEnd} />
            </linearGradient>
          ))}
          <radialGradient id="pie-core-gradient" cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor={isDarkMode ? "rgba(33, 42, 52, 0.98)" : "rgba(244, 247, 252, 0.98)"} />
            <stop offset="100%" stopColor={isDarkMode ? "rgba(12, 18, 24, 0.98)" : "rgba(213, 221, 235, 0.98)"} />
          </radialGradient>
          <linearGradient id="pie-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <ellipse cx={cx} cy={cy + depth + 8} rx={outerRx + 8} ry={outerRy + 10} className="pie-floor-shadow" />

        {outerWalls.map((wall) => (
          <path key={wall.key} d={wall.path} fill={wall.fill} className="pie-side-wall" />
        ))}

        {innerWalls.map((wall) => (
          <path key={wall.key} d={wall.path} fill={wall.fill} className="pie-inner-wall" />
        ))}

        {geometry.map((segment) => (
          <path
            key={segment.label}
            d={buildDonutSegmentPath(cx, cy, outerRx, outerRy, innerRx, innerRy, segment.startAngle, segment.endAngle)}
            fill={`url(#top-segment-${segment.index})`}
            className="pie-top-segment"
          />
        ))}

        <path
          d={buildDonutSegmentPath(cx, cy - 2, outerRx - 8, outerRy - 10, outerRx - 28, outerRy - 24, -2.72, -1.66)}
          fill="url(#pie-sheen)"
          className="pie-top-sheen"
        />
        <ellipse cx={cx} cy={cy} rx={innerRx} ry={innerRy} fill="url(#pie-core-gradient)" className="pie-core-disc" />
        <text x={cx} y={cy + 8} textAnchor="middle" className="pie-core-label">
          事务占比
        </text>
      </svg>
    </div>
  );
}
