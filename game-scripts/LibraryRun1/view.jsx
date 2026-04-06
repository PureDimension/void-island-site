import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
const {
  getBuffDescriptions: modelGetBuffDescriptions,
  getPowerDisplay: modelGetPowerDisplay,
  buildCenterFeed: modelBuildCenterFeed,
  buildDisplayBattle: modelBuildDisplayBattle,
  getAbilityContextEntries: modelGetAbilityContextEntries,
  getUnitDisplayMode: modelGetUnitDisplayMode,
  isManualTargetable: modelIsManualTargetable,
  isPlayerVisibleEnemy: modelIsPlayerVisibleEnemy,
  isPlayerCommandable: modelIsPlayerCommandable,
  canPlayerChooseTarget: modelCanPlayerChooseTarget,
  getForcedTargetId: modelGetForcedTargetId,
  getVirusState: modelGetVirusState,
  hasLockedTarget: modelHasLockedTarget,
  getUnitActiveSkills: modelGetUnitActiveSkills,
} = require("./engine/view-model");
const { BUFF_CATALOG, MARK_BUFF, VIRUS_BUFF } = require("./data/buffs");
const { getStoryBackground } = require("./data/backgrounds");
const { buildAssetUrl, resolveMusicTrack } = require("./data/music");
const { getTipsForStage } = require("./data/tips");

const TAG_SYMBOLS = {
  "◆": "◆",
  "▲": "▲",
  "▼": "▼",
  "●": "●",
  "※": "※",
};

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2;
}

function hasHighlight(step, type, id) {
  return !!step?.highlights?.some((item) => item.type === type && item.id === id);
}

function findHighlightedUnit(step) {
  return step?.highlights?.find((item) => item.type === "unit")?.id || null;
}

function MusicPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="music-icon" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MusicPauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="music-icon" stroke="currentColor" strokeWidth="1.7">
      <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function useHideMusicPlayer() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.body.classList.add("library-run-hide-player");
    const touchedNodes = new Set();

    const hidePlayers = () => {
      const nodes = document.querySelectorAll(".fixed.bottom-4.left-4.z-50");
      nodes.forEach((node) => {
        if (!node.querySelector("audio")) {
          return;
        }
        if (!node.dataset.libraryRunOriginalDisplay) {
          node.dataset.libraryRunOriginalDisplay = node.style.display || "";
        }
        node.style.display = "none";
        touchedNodes.add(node);
      });
    };

    hidePlayers();
    const observer = new MutationObserver(hidePlayers);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove("library-run-hide-player");
      touchedNodes.forEach((node) => {
        if (node.dataset.libraryRunOriginalDisplay !== undefined) {
          node.style.display = node.dataset.libraryRunOriginalDisplay;
          delete node.dataset.libraryRunOriginalDisplay;
        }
      });
    };
  }, []);
}

function useStageMusic(gameState) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notice, setNotice] = useState(null);
  const track = useMemo(() => resolveMusicTrack(gameState), [gameState]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = setTimeout(() => setNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) {
      return undefined;
    }

    let cancelled = false;
    audio.pause();
    audio.currentTime = 0;
    audio.src = buildAssetUrl(track.fileName);
    audio.loop = true;
    audio.preload = "auto";

    const tryPlay = () => {
      if (!enabled) {
        audio.pause();
        setIsPlaying(false);
        return;
      }

      const playPromise = audio.play();
      if (playPromise?.then) {
        playPromise
          .then(() => {
            if (cancelled) {
              return;
            }
            setIsPlaying(true);
            setNotice(track);
          })
          .catch(() => {
            if (cancelled) {
              return;
            }
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(!audio.paused);
        setNotice(track);
      }
    };

    tryPlay();

    const resumeOnGesture = () => {
      if (audio.paused && enabled) {
        tryPlay();
      }
    };

    window.addEventListener("pointerdown", resumeOnGesture);
    window.addEventListener("keydown", resumeOnGesture);

    return () => {
      cancelled = true;
      audio.pause();
      window.removeEventListener("pointerdown", resumeOnGesture);
      window.removeEventListener("keydown", resumeOnGesture);
    };
  }, [track?.key, enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const sync = () => setIsPlaying(!audio.paused);
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (enabled && !audio.paused) {
      audio.pause();
      setEnabled(false);
      setIsPlaying(false);
      return;
    }
    setEnabled(true);
    if (audio.src !== buildAssetUrl(track.fileName)) {
      audio.src = buildAssetUrl(track.fileName);
    }
    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setNotice(track);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      setIsPlaying(true);
      setNotice(track);
    }
  };

  return {
    audioRef,
    enabled,
    isPlaying,
    notice,
    setNotice,
    track,
    toggle,
  };
}

function useBattleViewport(rootRef, enabled) {
  useLayoutEffect(() => {
    if (!enabled || !rootRef.current || typeof window === "undefined") {
      return undefined;
    }

    const root = rootRef.current;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      const available = Math.max(400, window.innerHeight - rect.top - 12);
      root.style.setProperty("--library-run-available-height", `${available}px`);
    };

    measure();
    window.addEventListener("resize", measure);
    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(root);
      if (root.parentElement) {
        resizeObserver.observe(root.parentElement);
      }
    }

    return () => {
      window.removeEventListener("resize", measure);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [enabled, rootRef]);
}

function StoryView({ gameState, onAction }) {
  const sceneId = gameState.story.sceneId;
  const pageIndex = gameState.story.index;
  const page = gameState.story.pages[pageIndex];
  const [revealedCount, setRevealedCount] = useState(1);

  useEffect(() => {
    setRevealedCount(1);
  }, [sceneId, pageIndex]);

  const done = revealedCount >= page.paragraphs.length;

  const handleAdvance = () => {
    if (!done) {
      setRevealedCount((value) => Math.min(value + 1, page.paragraphs.length));
      return;
    }
    onAction("next-story", {});
  };

  return (
    <>
      <div className="story-shell" onClick={handleAdvance} role="button" tabIndex={0}>
        <div className="story-noise" />
        <div className={`story-page ${page.tone === "unlock-red" ? "tone-red" : ""}`.trim()}>
          <div className="story-index">{String(pageIndex + 1).padStart(2, "0")}</div>
          <div className="story-body">
            {page.paragraphs.slice(0, revealedCount).map((paragraph, index) => (
              <p key={`${pageIndex}-${index}`} className="story-paragraph fade-in">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="story-hint">
            {done ? "点击进入下一页" : "点击阅读下一段剧情"}
          </div>
        </div>
      </div>
    </>
  );
}

function GuideCard({ step, onNext }) {
  if (!step) {
    return null;
  }

  const canAdvance = step.mode === "manual" || step.mode === "free";

  return (
    <div className={`guide-card ${step.placement === "side" ? "side" : "center"}`}>
      <div className="guide-speaker">{step.speaker}</div>
      <p className="guide-text">{step.text}</p>
      {step.callouts?.length ? (
        <div className="guide-callouts">
          {step.callouts.map((item) => (
            <div key={item} className="guide-callout">
              {item}
            </div>
          ))}
        </div>
      ) : null}
      {canAdvance ? (
        <button type="button" className="mini-button strong" onClick={onNext}>
          {step.mode === "free" ? "开始行动" : "继续"}
        </button>
      ) : (
        <div className="guide-hint">
          {step.mode === "attack"
            ? "请按提示选择攻击者与目标"
            : step.mode === "undo"
              ? "请点击右上角 BACK 回到上一步"
              : "请用右侧 CONFIRM 确认敌方回合"}
        </div>
      )}
    </div>
  );
}

function Overlay({ title, children, onClose, cardClassName = "" }) {
  return (
    <div className="overlay-mask" onClick={onClose}>
      <div className={`overlay-card ${cardClassName}`.trim()} onClick={(event) => event.stopPropagation()}>
        <div className="panel-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function LogOverlay({ battle, onClose }) {
  return (
    <Overlay title="行动记录" onClose={onClose} cardClassName="log-card">
      <div className="log-list">
        {(battle?.actionLog || []).slice().reverse().map((entry, index) => (
          <div key={`${entry.turn}-${entry.type}-${index}`} className="log-line">
            <span className="log-turn">T{entry.turn}</span>
            <span className={`log-type ${entry.type}`}>{entry.type}</span>
            <span>{entry.text}</span>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

function RulesOverlay({ rules, onClose }) {
  return (
    <Overlay title="RULES" onClose={onClose} cardClassName="rules-card">
      <div className="rules-list">
        {(rules || []).map((rule, index) => (
          <div key={rule} className="rule-line">
            <span className="rule-index">{String(index + 1).padStart(2, "0")}</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

function ModeSelectOverlay({ onPick }) {
  return (
    <div className="overlay-mask mode-select-mask">
      <div className="overlay-card mode-select-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-title">选择模式</div>
        <p className="panel-copy">
          故事模式中，影子会随着剧情推进逐步解锁能力，适合喜欢剧情和愉快体验的休闲玩家；挑战模式中，影子将保持无能力的状态，适合想要充分体验解谜乐趣的玩家。即使是在故事模式中，也可以尝试在不发动影子能力的情况下通关游戏！
        </p>
        <div className="mode-select-grid">
          <button type="button" className="mode-option story" onClick={() => onPick("story")}>
            <div className="mode-option-title">故事模式</div>
            <div className="mode-option-copy">保留剧情能力解锁与专属演出。</div>
          </button>
          <button type="button" className="mode-option challenge" onClick={() => onPick("challenge")}>
            <div className="mode-option-title">挑战模式</div>
            <div className="mode-option-copy">影子不获得额外能力，按纯解谜规则推进。</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function TipsOverlay({ items, onSelect, onClose }) {
  return (
    <Overlay title="TIPS" onClose={onClose} cardClassName="tips-card">
      <div className="tips-list">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`tip-row ${item.status}`}
            disabled={item.status === "locked"}
            onClick={() => onSelect(item)}
          >
            <div className="tip-index">
              {item.status === "locked"
                ? "\uD83D\uDD12"
                : item.status === "revealed"
                  ? "\uD83D\uDD13"
                  : String(index + 1).padStart(2, "0")}
            </div>
            <div className="tip-text">
              {item.text}
            </div>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function TipDetailOverlay({ item, onClose }) {
  if (!item) {
    return null;
  }
  return (
    <Overlay title={item.teaser} onClose={onClose} cardClassName="tips-card">
      <div className="tip-detail-copy">
        {item.revealedText}
      </div>
    </Overlay>
  );
}

function FailureOverlay({ reason, onUndo, onGiveUp }) {
  return (
    <div className="overlay-mask">
      <div className="overlay-card">
        <div className="panel-title">行动失败</div>
        <p className="panel-copy">{reason}</p>
        <div className="overlay-actions">
          <button type="button" className="mini-button strong" onClick={onUndo}>
            返回上一步
          </button>
          <button type="button" className="mini-button" onClick={onGiveUp}>
            放弃
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({ finalResults }) {
  return (
    <div className="overlay-mask">
      <div className="overlay-card">
        <div className="panel-title">
          {finalResults?.outcome === "victory" ? "突破完成" : "行动结束"}
        </div>
        {finalResults?.rating ? <p className="panel-copy">评级：{finalResults.rating}</p> : null}
        {finalResults?.reason ? <p className="panel-copy">{finalResults.reason}</p> : null}
      </div>
    </div>
  );
}

function ArrowLayer({ arrow }) {
  if (!arrow) {
    return null;
  }

  return (
    <svg
      className={`battle-arrow ${arrow.variant || (arrow.hostile ? "hostile" : "friendly")} ${arrow.dashed ? "dashed" : ""} ${arrow.chainPhase || ""}`.trim()}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker id="library-run-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
        </marker>
      </defs>
      <line
        x1={arrow.x1}
        y1={arrow.y1}
        x2={arrow.x2}
        y2={arrow.y2}
        pathLength="100"
        markerEnd="url(#library-run-arrow-head)"
      />
    </svg>
  );
}

function MotionLinkLayer({ link, phase }) {
  if (!(link && Number.isFinite(link.px1) && Number.isFinite(link.px2))) {
    return null;
  }

  const dx = link.px2 - link.px1;
  const dy = link.py2 - link.py1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  return (
    <div className={`motion-link-layer ${phase || ""}`.trim()}>
      <div
        className="motion-link-core"
        style={{
          left: `${link.px1}px`,
          top: `${link.py1}px`,
          width: `${length}px`,
          transform: `translateY(-50%) rotate(${angle}deg)`,
        }}
      />
      <div
        className="motion-link-trace"
        style={{
          left: `${link.px1}px`,
          top: `${link.py1}px`,
          width: `${length}px`,
          transform: `translateY(-50%) rotate(${angle}deg)`,
        }}
      />
    </div>
  );
}

function SpaceReorgOverlay({ state }) {
  if (!state?.active) {
    return null;
  }

  const cols = 14;
  const rows = 9;
  const choosingAmount = state.phase === "amount";
  const isAnimating = state.phase === "animating" || state.phase === "release";
  const isClosing = state.phase === "release";
  const currentLink = state.dragChain || state.chain || null;
  const displayMessage = (() => {
    if (state.phase === "amount") {
      return "请选择要转移的 POWER 数值。";
    }
    if (false && state.phase === "animating" && state.targetFloat) {
      return "前段重组完成，正在将 POWER 重塑到目标单元。";
    }
    if (state.phase === "animating") {
      return "空间质正在重组，请稍候……";
    }
    if (state.phase === "release") {
      return "重组完成，正在解除蜂巢网络。";
    }
    if (state.phase === "dragging") {
      return "拖到需要增加 POWER 的己方单位上，松开即可完成连接。";
    }
    return "请从需要减少 POWER 的单位拖向需要增加 POWER 的单位。";
  })();
  const horizontalLines = [];
  const verticalLines = [];
  const cells = [];

  for (let row = 0; row <= rows; row += 1) {
    horizontalLines.push({
      key: `h-${row}`,
      style: {
        left: "0%",
        top: `${row * (100 / rows)}%`,
        width: "100%",
        "--order": row,
      },
    });
  }

  for (let col = 0; col <= cols; col += 1) {
    verticalLines.push({
      key: `v-${col}`,
      style: {
        left: `${col * (100 / cols)}%`,
        top: "0%",
        height: "100%",
        "--order": col,
      },
    });
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const seed = (row * 17 + col * 29) % 7;
      cells.push({
        key: `c-${row}-${col}`,
        style: {
          left: `${col * (100 / cols)}%`,
          top: `${row * (100 / rows)}%`,
          width: `${100 / cols}%`,
          height: `${100 / rows}%`,
          "--order": row * cols + col,
          "--cell-delay": `${seed * 0.33}s`,
          "--cell-duration": `${2.6 + seed * 0.24}s`,
        },
      });
    }
  }

  return (
    <>
      <div className={`space-reorg-backdrop ${isAnimating ? "animating" : ""} ${isClosing ? "closing" : ""}`}>
        <div className="space-reorg-whitewash" />
        <div className="space-reorg-grid-field">
          {horizontalLines.map((item) => (
            <div key={item.key} className="space-reorg-grid-line horizontal" style={item.style}>
              <span className="space-reorg-grid-stroke horizontal" />
            </div>
          ))}
          {verticalLines.map((item) => (
            <div key={item.key} className="space-reorg-grid-line vertical" style={item.style}>
              <span className="space-reorg-grid-stroke vertical" />
            </div>
          ))}
        </div>
        <div className="space-reorg-cell-field">
          {cells.map((item) => (
            <div key={item.key} className="space-reorg-cell" style={item.style} />
          ))}
        </div>
      </div>
      <div className={`space-reorg-overlay ${isAnimating ? "animating" : ""} ${isClosing ? "closing" : ""}`}>
        {currentLink ? <MotionLinkLayer link={currentLink} phase={state.phase} /> : null}
        <div className="space-reorg-center">
          <div className="space-reorg-kicker">空间重组</div>
          <div className="space-reorg-copy">{displayMessage}</div>
          {choosingAmount ? (
            <div className="space-reorg-amounts slider-mode">
              <div className="space-reorg-slider-readout">{state.amountValue}</div>
              <input
                type="range"
                className="space-reorg-slider"
                min={state.amountMin}
                max={state.amountMax}
                step="1"
                value={state.amountValue}
                onChange={(event) => state.onAmountChange?.(Number(event.target.value))}
              />
              <div className="space-reorg-slider-scale">
                <span>{state.amountMin}</span>
                <span>{state.amountMax}</span>
              </div>
              <button
                type="button"
                className="space-reorg-amount confirm"
                onClick={() => state.onAmount(state.amountValue)}
              >
                确认
              </button>
            </div>
          ) : null}
        </div>
        {state.sourceFloat ? (
          <div className="space-reorg-float source" style={state.sourceFloat.style}>
            {state.sourceFloat.text}
          </div>
        ) : null}
        {state.targetFloat ? (
          <div className="space-reorg-float target" style={state.targetFloat.style}>
            {state.targetFloat.text}
          </div>
        ) : null}
      </div>
    </>
  );
}

function TimeElapseBoardClone({
  enemyUnits,
  playerUnits,
  gameState,
  centerFeed,
}) {
  return (
    <div className="time-elapse-clone-board">
      <div className="row enemy-row time-elapse-clone-row">
        {enemyUnits.map((unit) => (
          <UnitCell
            key={`time-enemy-${unit.id}`}
            unit={unit}
            gameState={gameState}
          />
        ))}
      </div>
      <div className="stage-middle time-elapse-clone-middle">
        <div className="center-feed">
          {centerFeed.map((item) => (
            <div key={`time-feed-${item.key}`} className={`feed-line ${item.type}`}>
              {item.text}
            </div>
          ))}
        </div>
      </div>
      <div className="row player-row time-elapse-clone-row">
        {playerUnits.map((unit) => (
          <UnitCell
            key={`time-player-${unit.id}`}
            unit={unit}
            gameState={gameState}
          />
        ))}
      </div>
    </div>
  );
}

function TimeElapseOverlay({
  state,
  enemyUnits,
  playerUnits,
  gameState,
  centerFeed,
  skippedBadge,
}) {
  if (!state?.active) {
    return null;
  }

  const wavePresets = [
    { key: "r1", duration: "2.4s", delay: "0s" },
    { key: "r2", duration: "2.9s", delay: "0.56s" },
    { key: "r3", duration: "2.66s", delay: "1.08s" },
  ];

  const distortionPresets = [
    { key: "d1", duration: "2.42s", delay: "0s", filter: "time-elapse-displace-a", drift: "time-elapse-distort-drift-a" },
    { key: "d2", duration: "2.94s", delay: "0.48s", filter: "time-elapse-displace-b", drift: "time-elapse-distort-drift-b" },
    { key: "d3", duration: "2.72s", delay: "1.02s", filter: "time-elapse-displace-c", drift: "time-elapse-distort-drift-c" },
  ];

  return (
    <div className={`time-elapse-overlay ${state.phase || ""}`.trim()}>
      <svg className="time-elapse-defs" aria-hidden="true" width="0" height="0" focusable="false">
        <defs>
          <filter id="time-elapse-displace-a" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="1" seed="17" result="noise">
              <animate attributeName="baseFrequency" values="0.008 0.02;0.014 0.028;0.009 0.022;0.008 0.02" dur="2.42s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" values="0;15;10;4;0" dur="2.42s" repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
          <filter id="time-elapse-displace-b" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.01 0.017" numOctaves="1" seed="29" result="noise">
              <animate attributeName="baseFrequency" values="0.01 0.017;0.016 0.024;0.011 0.018;0.01 0.017" dur="2.94s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="B" yChannelSelector="G">
              <animate attributeName="scale" values="0;14;9;4;0" dur="2.94s" repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
          <filter id="time-elapse-displace-c" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.024" numOctaves="1" seed="41" result="noise">
              <animate attributeName="baseFrequency" values="0.009 0.024;0.014 0.032;0.01 0.026;0.009 0.024" dur="2.72s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="B">
              <animate attributeName="scale" values="0;16;11;5;0" dur="2.72s" repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>
      <div className="time-elapse-distortions">
        {distortionPresets.map((layer) => (
          <div
            key={layer.key}
            className={`time-elapse-distortion ${layer.key}`}
            style={{
              "--distort-duration": layer.duration,
              "--distort-delay": layer.delay,
            }}
          >
            <div
              className={`time-elapse-distortion-board ${layer.drift}`}
              style={{ filter: `url(#${layer.filter})` }}
            >
              <TimeElapseBoardClone
                enemyUnits={enemyUnits}
                playerUnits={playerUnits}
                gameState={gameState}
                centerFeed={centerFeed}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="time-elapse-stage">
        <div className="time-elapse-ripples">
          {wavePresets.map((wave) => (
            <span
              key={wave.key}
              className={`time-elapse-ripple ${wave.key}`}
              style={{
                "--wave-duration": wave.duration,
                "--wave-delay": wave.delay,
              }}
            />
          ))}
        </div>
        <div className="time-elapse-clock">
          <span className="time-elapse-hand minute" />
          <span className="time-elapse-hand hour" />
          <span className="time-elapse-center-dot" />
        </div>
      </div>
      <div className={`time-elapse-turn ${state.phase === "turn-pop" ? "pop" : ""}`.trim()}>
        TURN+1
      </div>
      {skippedBadge ? (
        <div
          className="time-elapse-skip-badge"
          style={{
            left: `${skippedBadge.x}%`,
            top: `${skippedBadge.y}%`,
          }}
        >
          已跳过该单位的回合
        </div>
      ) : null}
    </div>
  );
}

function CellMeta({ unit, gameState, virusStateOverride }) {
  const power = modelGetPowerDisplay(unit, gameState);
  const virusState = virusStateOverride ?? modelGetVirusState(unit);
  const buffLabels = Object.values(BUFF_CATALOG)
    .filter((buff) => buff.key !== MARK_BUFF)
    .filter((buff) => (unit?.buffs?.[buff.key] || 0) > 0)
    .map((buff) => (
      buff.key === VIRUS_BUFF
        ? (virusState === "active" ? "【病毒生效】" : "【病毒潜伏】")
        : `【${buff.shortLabel}】`
    ));
  const hasMark = !!(unit?.buffs?.[MARK_BUFF] > 0);

  return (
    <div className="cell-meta">
      <div className="unit-power-line">
        <span className="power-label">POWER</span>
        {hasMark ? <span className="power-mark">✛</span> : null}
        <span className="power-value">{power.value}</span>
        {power.suffix ? <span className="power-suffix">{power.suffix}</span> : null}
      </div>
      <div className="unit-name">{unit.name}</div>
      <div className="unit-tags">
        {unit.tags.map((tag) => (
          <span key={`${unit.id}-${tag}`} className="tag-chip">
            {TAG_SYMBOLS[tag] || tag}
          </span>
        ))}
      </div>
      {buffLabels.length > 0 ? (
        <div className="unit-buffs">
          {buffLabels.map((buff) => (
            <span key={`${unit.id}-${buff}`} className="buff-chip">
              {buff}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UnitCell({
  unit,
  gameState,
  inspected,
  guideGlow,
  attackerReady,
  attackerSelected,
  targetReady,
  targetSelected,
  friendlyAttacker,
  friendlyDefender,
  hostileAttacker,
  hostileDefender,
  onClick,
  onTopClick,
  onBottomClick,
  onCancelAttacker,
  onCancelTarget,
  registerRef,
  incomingBuffText,
  spaceReorgSource,
  spaceReorgTarget,
  virusStateOverride,
  timeSkipHighlight,
}) {
  const isDisguise = modelGetUnitDisplayMode(unit) === "split";
  const forceTargetLocked = modelHasLockedTarget(unit);

  const rootClassName = [
    "unit-cell",
    inspected ? "inspected" : "",
    guideGlow ? "guide-glow" : "",
    attackerReady ? "attacker-ready" : "",
    attackerSelected ? "attacker-selected" : "",
    targetReady ? "target-ready" : "",
    targetSelected ? "target-selected" : "",
    friendlyAttacker ? "friendly-attacker" : "",
    friendlyDefender ? "friendly-defender" : "",
    hostileAttacker ? "hostile-attacker" : "",
    hostileDefender ? "hostile-defender" : "",
    spaceReorgSource ? "space-reorg-source" : "",
    spaceReorgTarget ? "space-reorg-target" : "",
    timeSkipHighlight ? "time-skip-highlight" : "",
    !unit.alive ? "dead" : "",
    isDisguise ? "disguise-cell" : "",
  ].filter(Boolean).join(" ");

  if (!isDisguise) {
    return (
      <div className={rootClassName} ref={registerRef} data-unit-id={unit.id}>
        {(spaceReorgSource || spaceReorgTarget) ? <div className={`space-reorg-aura ${spaceReorgSource ? "source" : "target"}`} /> : null}
        <div className="unit-shell" data-unit-id={unit.id}>
          {(spaceReorgSource || spaceReorgTarget) ? <div className={`space-reorg-inner ${spaceReorgSource ? "source" : "target"}`} /> : null}
          <button type="button" className="unit-button" onClick={onClick} data-unit-id={unit.id} />
          {incomingBuffText ? <div className="incoming-buff-callout">{incomingBuffText}</div> : null}
          <CellMeta unit={unit} gameState={gameState} virusStateOverride={virusStateOverride} />
          {attackerSelected && onCancelAttacker ? (
            <button type="button" className="cancel-chip" onClick={onCancelAttacker}>
              ×
            </button>
          ) : null}
          {targetSelected && onCancelTarget && !forceTargetLocked ? (
            <button type="button" className="cancel-chip" onClick={onCancelTarget}>
              ×
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName} ref={registerRef} data-unit-id={unit.id}>
      {(spaceReorgSource || spaceReorgTarget) ? <div className={`space-reorg-aura ${spaceReorgSource ? "source" : "target"}`} /> : null}
      <div className="unit-shell disguise-shell" data-unit-id={unit.id}>
        {(spaceReorgSource || spaceReorgTarget) ? <div className={`space-reorg-inner ${spaceReorgSource ? "source" : "target"}`} /> : null}
        {incomingBuffText ? <div className="incoming-buff-callout">{incomingBuffText}</div> : null}
        <button
          type="button"
          className={[
            "segment-button",
            "top",
            targetReady ? "target-ready" : "",
            targetSelected ? "target-selected" : "",
          ].filter(Boolean).join(" ")}
          onClick={onTopClick}
          data-unit-id={unit.id}
        />
        <button
          type="button"
          className={[
            "segment-button",
            "bottom",
            attackerReady ? "attacker-ready" : "",
            attackerSelected ? "attacker-selected" : "",
          ].filter(Boolean).join(" ")}
          onClick={onBottomClick}
          data-unit-id={unit.id}
        />
        <CellMeta unit={unit} gameState={gameState} virusStateOverride={virusStateOverride} />
        {attackerSelected && onCancelAttacker ? (
          <button type="button" className="cancel-chip bottom" onClick={onCancelAttacker}>
            ×
          </button>
        ) : null}
        {targetSelected && onCancelTarget && !forceTargetLocked ? (
          <button type="button" className="cancel-chip top" onClick={onCancelTarget}>
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SidePanel({
  battle,
  selectedUnit,
  gameState,
  enemyConfirm,
  canAttack,
  onAttack,
  onConfirmEnemy,
  onUseActiveSkill,
  skillLocked,
  guideStep,
}) {
  const power = modelGetPowerDisplay(selectedUnit, gameState);
  const buffDescriptions = modelGetBuffDescriptions(selectedUnit);
  const abilityContextEntries = modelGetAbilityContextEntries(selectedUnit, battle);
  const activeSkills = modelGetUnitActiveSkills(selectedUnit, battle);
  const descriptionLines = useMemo(() => {
    const text = selectedUnit?.description || "";
    if (!text) {
      return [];
    }
    return text
      .split(/(?<=[。；])/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [selectedUnit]);

  return (
    <aside className="side-panel">
      <div className={`panel-card script-card ${hasHighlight(guideStep, "panel", "enemy-script") ? "guide-glow" : ""}`}>
        <div className="panel-kicker">{battle?.title}</div>
        <div className="panel-title">敌方行动</div>
        <div className="script-lines">
          {(battle?.enemyLogicText || []).map((line) => (
            <p key={line} className="panel-copy mono">
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="panel-card detail-card">
        {selectedUnit ? (
          <>
            <div className="detail-head">
              <div>
                <div className="panel-title">{selectedUnit.name}</div>
                <div className={`unit-tags side-tags ${hasHighlight(guideStep, "area", "unit-tags") ? "guide-glow-inline" : ""}`}>
                  {selectedUnit.tags.map((tag) => (
                    <span key={`${selectedUnit.id}-${tag}`} className="tag-chip large">
                      {TAG_SYMBOLS[tag] || tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="side-power">
                <span className="side-power-main">{power.value}</span>
                {power.suffix ? <span className="side-power-suffix">{power.suffix}</span> : null}
              </div>
            </div>

            <div className={hasHighlight(guideStep, "area", "panel-description") ? "guide-glow-inline blockish" : ""}>
              {descriptionLines.map((line) => (
                <div key={line} className="panel-copy description-line">
                  {line}
                </div>
              ))}
            </div>
            {abilityContextEntries.map((entry) => (
              <div key={`${entry.key}-${entry.value}`} className="panel-copy context-line">
                <span className="context-key">{entry.key}</span>
                <span>{entry.value}</span>
              </div>
            ))}

            <div className="panel-subtitle">BUFF</div>
            <div className={hasHighlight(guideStep, "area", "panel-buffs") ? "guide-glow-inline blockish" : ""}>
            {buffDescriptions.length > 0 ? (
                buffDescriptions.map((buff) => (
                  <div key={buff} className="panel-copy">
                    {buff}
                  </div>
                ))
              ) : (
                <div className="panel-copy dim">当前没有异常状态。</div>
              )}
            </div>

            {activeSkills.length > 0 ? (
              <>
                <div className="panel-subtitle">主动技能</div>
                <div className="skill-grid">
                  {activeSkills.map((skill) => (
                    <button
                      key={skill.key}
                      type="button"
                      className={`mini-button skill-button ${skill.used ? "used" : "strong"}`}
                      onClick={() => onUseActiveSkill?.(skill)}
                      disabled={(skill.oncePerStage && skill.used) || skillLocked}
                    >
                      <span>{skill.label}</span>
                      <span className="skill-badge">{skill.used ? "已发动" : "可发动"}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="panel-title">单位信息</div>
            <p className="panel-copy dim">点击任意单位后，这里会显示它的描述、BUFF 与主动操作。</p>
          </>
        )}
      </div>

      <button
        type="button"
        className={`action-button ${enemyConfirm ? "confirm" : ""} ${hasHighlight(guideStep, "area", "action-button") ? "guide-glow" : ""}`}
        onClick={enemyConfirm ? onConfirmEnemy : onAttack}
        disabled={enemyConfirm ? false : !canAttack}
      >
        {enemyConfirm ? "CONFIRM" : "ATTACK"}
      </button>
    </aside>
  );
}

export default function LibraryRun1View({ gameState, onAction }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const nodeRefs = useRef({});
  const dragPointerRef = useRef(null);

  const [selectedAttackerId, setSelectedAttackerId] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [inspectId, setInspectId] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [openTipId, setOpenTipId] = useState(null);
  const [arrow, setArrow] = useState(null);
  const [selectionNotice, setSelectionNotice] = useState(null);
  const [spaceReorg, setSpaceReorg] = useState(null);
  const [timeElapseFx, setTimeElapseFx] = useState(null);
  const [skippedTurnBadge, setSkippedTurnBadge] = useState(null);
  const skillTimersRef = useRef([]);

  useHideMusicPlayer();
  useBattleViewport(rootRef, gameState?.phase !== "STORY" && gameState?.phase !== "MODE_SELECT");
  const music = useStageMusic(gameState);
  const isStoryPhase = gameState?.phase === "STORY";
  const isModeSelectPhase = gameState?.phase === "MODE_SELECT";

  const battle = gameState?.battle || null;
  const rootBackground = useMemo(
    () => getStoryBackground(gameState?.storyBackground || "default"),
    [gameState?.storyBackground]
  );
  const enemyConfirm = battle?.pendingEnemyAction || null;
  const displayTurn = enemyConfirm ? Math.max(1, (battle?.turn || 1) - 1) : (battle?.turn || 1);
  const skippedTurnUnitId = timeElapseFx?.active ? (battle?.stageRuntime?.timeElapseSkippedUnitId || null) : null;
  const displayBattle = useMemo(() => modelBuildDisplayBattle(battle, enemyConfirm), [battle, enemyConfirm]);
  const guideStep = battle?.currentGuideStep || null;

  const allUnits = useMemo(
    () => (displayBattle ? [...displayBattle.playerUnits, ...displayBattle.enemyUnits] : []),
    [displayBattle]
  );
  const playerUnits = useMemo(
    () => allUnits
      .filter((unit) => (unit.baseSide ?? unit.side) === "player")
      .sort((a, b) => a.slot - b.slot),
    [allUnits]
  );
  const enemyUnits = useMemo(
    () => allUnits
      .filter((unit) => (unit.baseSide ?? unit.side) === "enemy")
      .sort((a, b) => a.slot - b.slot),
    [allUnits]
  );

  const selectedAttacker = allUnits.find((unit) => unit.id === selectedAttackerId) || null;
  const selectedTarget = allUnits.find((unit) => unit.id === selectedTargetId) || null;
  const activeSkillOverlay = (spaceReorg?.active || timeElapseFx?.active) ? (spaceReorg || timeElapseFx) : null;
  const forcedTargetId = selectedAttacker ? modelGetForcedTargetId(battle, selectedAttacker) : null;
  const stageTips = useMemo(() => getTipsForStage(battle?.stageId), [battle?.stageId]);
  const revealedTipIds = battle?.stageId ? (gameState?.campaign?.revealedTips?.[battle.stageId] || []) : [];
  const inspectedUnit = allUnits.find((unit) => unit.id === inspectId)
    || selectedAttacker
    || playerUnits.find((unit) => unit.alive)
    || enemyUnits.find((unit) => unit.alive)
    || null;

  const centerFeed = useMemo(() => modelBuildCenterFeed(battle?.actionLog || []), [battle?.actionLog]);
  const tipItems = useMemo(() => {
    const revealed = new Set(revealedTipIds);
    return stageTips.map((tip) => {
      const available = (tip.require || []).every((id) => revealed.has(id));
      const isRevealed = revealed.has(tip.id);
      return {
        ...tip,
        status: isRevealed ? "revealed" : (available ? "available" : "locked"),
        text: isRevealed || available ? tip.teaser : "",
      };
    });
  }, [stageTips, revealedTipIds]);
  const openTipItem = useMemo(
    () => tipItems.find((item) => item.id === openTipId && item.status === "revealed") || null,
    [tipItems, openTipId]
  );
  const incomingAntibodyTargetId = useMemo(() => {
    if (!enemyConfirm?.attackerId) {
      return null;
    }
    const attacker = allUnits.find((unit) => unit.id === enemyConfirm.attackerId);
    if (!(attacker && (attacker.abilityCode === "macrophage-command" || attacker.abilityCode === "gateway-b-cell"))) {
      return null;
    }

    const sameSideUnits = allUnits
      .filter((unit) => unit.alive)
      .filter((unit) => (unit.baseSide ?? unit.side) === (attacker.baseSide ?? attacker.side))
      .filter((unit) => Object.values(unit.buffs || {}).every((value) => !value));

    if (!sameSideUnits.length) {
      return null;
    }

    const sorted = [...sameSideUnits].sort((left, right) => {
      if (attacker.abilityCode === "gateway-b-cell") {
        if (right.power !== left.power) {
          return right.power - left.power;
        }
      } else if (left.power !== right.power) {
        return left.power - right.power;
      }
      return left.slot - right.slot;
    });

    return sorted[0]?.id || null;
  }, [enemyConfirm, allUnits]);
  const getDisplayedVirusState = (unit) => {
    const currentState = modelGetVirusState(unit);
    if (!(unit && enemyConfirm && currentState === "active" && unit.buffs?.[VIRUS_BUFF] > 0)) {
      return currentState;
    }
    const currentTurn = battle?.turn || 1;
    const previousTurn = Math.max(0, currentTurn - 1);
    if (previousTurn < unit.power && currentTurn >= unit.power) {
      return "latent";
    }
    return currentState;
  };
  useEffect(() => {
    if (!battle) {
      return;
    }
    const defaultUnit = battle.playerUnits.find((unit) => unit.id === "p-robot" && unit.alive)
      || battle.playerUnits.find((unit) => unit.alive)
      || battle.enemyUnits.find((unit) => unit.alive)
      || null;
    setSelectedAttackerId(defaultUnit?.side === "player" ? defaultUnit.id : null);
    setSelectedTargetId(null);
    setInspectId(defaultUnit?.id || null);
    setArrow(null);
  }, [battle?.stageId]);

  useEffect(() => {
    if (!selectionNotice) {
      return undefined;
    }
    const timer = setTimeout(() => setSelectionNotice(null), 1600);
    return () => clearTimeout(timer);
  }, [selectionNotice]);

  useEffect(() => {
    const highlightedId = findHighlightedUnit(guideStep);
    if (highlightedId) {
      setInspectId(highlightedId);
    }
  }, [guideStep]);

  useEffect(() => {
    setOpenTipId(null);
  }, [battle?.stageId]);

  useEffect(() => () => {
    skillTimersRef.current.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    skillTimersRef.current.forEach((timer) => clearTimeout(timer));
    skillTimersRef.current = [];
    setSpaceReorg(null);
    setTimeElapseFx(null);
    setSkippedTurnBadge(null);
  }, [battle?.stageId]);

  useEffect(() => {
    if (!(spaceReorg?.active && spaceReorg.dragging && spaceReorg.sourceId)) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (dragPointerRef.current !== null && event.pointerId !== dragPointerRef.current) {
        return;
      }
      setSpaceReorg((current) => current ? {
        ...current,
        dragChain: buildConnectionToPoint(current.sourceId, event.clientX, event.clientY),
      } : current);
    };

    const handlePointerUp = (event) => {
      if (dragPointerRef.current !== null && event.pointerId !== dragPointerRef.current) {
        return;
      }
      dragPointerRef.current = null;
      const sourceUnit = allUnits.find((unit) => unit.id === spaceReorg.sourceId);
      const targetUnit = findPointerUnit(event.clientX, event.clientY);
      const maxTransfer = Math.min(sourceUnit?.power || 0, 9 - (targetUnit?.power || 0));

      if (!(targetUnit && targetUnit.id !== spaceReorg.sourceId && targetUnit.alive && maxTransfer >= 1)) {
        setSpaceReorg((current) => current ? {
          ...current,
          dragging: false,
          phase: "select-source",
          sourceId: null,
          targetId: null,
          chain: null,
          dragChain: null,
          message: "请从需要减少 POWER 的单位拖向需要增加 POWER 的单位。",
        } : current);
        return;
      }

      const chain = buildConnection(spaceReorg.sourceId, targetUnit.id);
      setSpaceReorg((current) => current ? {
        ...current,
        dragging: false,
        phase: "amount",
        targetId: targetUnit.id,
        chain,
        dragChain: null,
        amountMin: 1,
        amountMax: maxTransfer,
        amountValue: Math.min(Math.max(current.amountValue || 1, 1), maxTransfer),
        message: "请选择要转移的 POWER 数值。",
        onAmountChange: (value) => setSpaceReorg((latest) => latest ? {
          ...latest,
          amountValue: Math.min(Math.max(value, 1), maxTransfer),
        } : latest),
        onAmount: (value) => executeSpaceReorg({
          ...current,
          targetId: targetUnit.id,
          chain,
        }, value),
      } : current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [spaceReorg?.active, spaceReorg?.dragging, spaceReorg?.sourceId, allUnits]);

  useEffect(() => {
    if (!(spaceReorg?.active && (spaceReorg.sourceFloat || spaceReorg.targetFloat))) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSpaceReorg((current) => {
        if (!current?.active) {
          return current;
        }
        const updateFloat = (item) => {
          if (!item) {
            return item;
          }
          const progress = Math.min(1, Math.max(0, (Date.now() - item.start) / item.duration));
          const eased = easeInOutCubic(progress);
          const value = item.from + (item.to - item.from) * eased;
          return {
            ...item,
            text: value.toFixed(3),
          };
        };
        return {
          ...current,
          sourceFloat: updateFloat(current.sourceFloat),
          targetFloat: updateFloat(current.targetFloat),
        };
      });
    }, 33);

    return () => clearInterval(timer);
  }, [spaceReorg?.active, spaceReorg?.sourceFloat?.start, spaceReorg?.targetFloat?.start]);

  useEffect(() => {
    if (enemyConfirm?.defenderId) {
      setInspectId(enemyConfirm.defenderId);
    }
  }, [enemyConfirm?.defenderId]);

  useEffect(() => {
    const sourceId = enemyConfirm?.attackerId || selectedAttackerId;
    const targetId = enemyConfirm?.defenderId || selectedTargetId;

    if (!sourceId || !targetId) {
      setArrow(null);
      return;
    }

    const stageNode = stageRef.current;
    const sourceNode = nodeRefs.current[sourceId];
    const targetNode = nodeRefs.current[targetId];
    if (!stageNode || !sourceNode || !targetNode) {
      return;
    }

    const stageRect = stageNode.getBoundingClientRect();
    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();

    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    let sourceX = sourceCenterX;
    let sourceY = sourceCenterY;
    let targetX = targetCenterX;
    let targetY = targetCenterY;

    if (sourceCenterY < targetCenterY - 6) {
      sourceY = sourceRect.bottom - 3;
      targetY = targetRect.top + 3;
    } else if (sourceCenterY > targetCenterY + 6) {
      sourceY = sourceRect.top + 3;
      targetY = targetRect.bottom - 3;
    } else if (sourceCenterX < targetCenterX) {
      sourceX = sourceRect.right - 3;
      targetX = targetRect.left + 3;
    } else {
      sourceX = sourceRect.left + 3;
      targetX = targetRect.right - 3;
    }

    const x1 = ((sourceX - stageRect.left) / stageRect.width) * 100;
    const y1 = ((sourceY - stageRect.top) / stageRect.height) * 100;
    const x2 = ((targetX - stageRect.left) / stageRect.width) * 100;
    const y2 = ((targetY - stageRect.top) / stageRect.height) * 100;

    setArrow({
      x1,
      y1,
      x2,
      y2,
      hostile: enemyConfirm ? enemyConfirm.controllerSide === "enemy" : false,
      dashed: !!enemyConfirm?.dashed,
    });
  }, [selectedAttackerId, selectedTargetId, enemyConfirm, battle?.actionLog]);

  useEffect(() => {
    if (!(spaceReorg?.active && spaceReorg.sourceId && spaceReorg.targetId)) {
      return;
    }
    const chain = buildConnection(spaceReorg.sourceId, spaceReorg.targetId);
    if (!chain) {
      return;
    }
    setSpaceReorg((current) => {
      if (!(current?.active && current.sourceId === spaceReorg.sourceId && current.targetId === spaceReorg.targetId)) {
        return current;
      }
      return { ...current, chain };
    });
  }, [spaceReorg?.active, spaceReorg?.sourceId, spaceReorg?.targetId, battle?.actionLog]);

  useEffect(() => {
    if (!selectedTarget || enemyConfirm) {
      return;
    }
    if (!isTargetCandidate(selectedTarget)) {
      setSelectedTargetId(null);
    }
  }, [selectedTargetId, selectedAttackerId, enemyConfirm, displayBattle]);

  useEffect(() => {
    if (enemyConfirm) {
      return;
    }
    if (!selectedAttacker) {
      if (selectedTargetId) {
        setSelectedTargetId(null);
      }
      return;
    }
    if (forcedTargetId) {
      if (selectedTargetId !== forcedTargetId) {
        setSelectedTargetId(forcedTargetId);
      }
      return;
    }
    if (modelHasLockedTarget(selectedAttacker)) {
      if (selectedTargetId) {
        setSelectedTargetId(null);
      }
      setSelectionNotice("\u65e0\u53ef\u6307\u5b9a\u7684\u76ee\u6807");
      return;
    }
    if (selectedTargetId && !isTargetCandidate(selectedTarget, selectedAttacker)) {
      setSelectedTargetId(null);
    }
  }, [
    selectedAttackerId,
    forcedTargetId,
    selectedTargetId,
    enemyConfirm,
    battle?.turn,
    battle?.actionLog?.length,
  ]);

  if (!gameState) {
    return (
      <div className="library-run-root">
        <StyleBlock />
      </div>
    );
  }

  const confirmControllerSide = enemyConfirm?.controllerSide || null;
  const confirmAttackerId = enemyConfirm?.attackerId || null;
  const confirmDefenderId = enemyConfirm?.defenderId || null;

  const buildConnection = (sourceId, targetId) => {
    if (!(sourceId && targetId)) {
      return null;
    }
    const stageNode = stageRef.current;
    const sourceNode = nodeRefs.current[sourceId];
    const targetNode = nodeRefs.current[targetId];
    if (!stageNode || !sourceNode || !targetNode) {
      return null;
    }

    const stageRect = stageNode.getBoundingClientRect();
    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    return {
      x1: ((sourceX - stageRect.left) / stageRect.width) * 100,
      y1: ((sourceY - stageRect.top) / stageRect.height) * 100,
      x2: ((targetX - stageRect.left) / stageRect.width) * 100,
      y2: ((targetY - stageRect.top) / stageRect.height) * 100,
      px1: sourceX - stageRect.left,
      py1: sourceY - stageRect.top,
      px2: targetX - stageRect.left,
      py2: targetY - stageRect.top,
    };
  };

  const buildConnectionToPoint = (sourceId, clientX, clientY) => {
    const stageNode = stageRef.current;
    const sourceNode = nodeRefs.current[sourceId];
    if (!stageNode || !sourceNode) {
      return null;
    }
    const stageRect = stageNode.getBoundingClientRect();
    const sourceRect = sourceNode.getBoundingClientRect();
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    return {
      x1: ((sourceX - stageRect.left) / stageRect.width) * 100,
      y1: ((sourceY - stageRect.top) / stageRect.height) * 100,
      x2: ((clientX - stageRect.left) / stageRect.width) * 100,
      y2: ((clientY - stageRect.top) / stageRect.height) * 100,
      px1: sourceX - stageRect.left,
      py1: sourceY - stageRect.top,
      px2: clientX - stageRect.left,
      py2: clientY - stageRect.top,
    };
  };

  useEffect(() => {
    if (!(timeElapseFx?.active && skippedTurnUnitId)) {
      setSkippedTurnBadge(null);
      return;
    }
    const stageNode = stageRef.current;
    const unitNode = nodeRefs.current[skippedTurnUnitId];
    if (!(stageNode && unitNode)) {
      setSkippedTurnBadge(null);
      return;
    }
    const stageRect = stageNode.getBoundingClientRect();
    const unitRect = unitNode.getBoundingClientRect();
    setSkippedTurnBadge({
      x: ((unitRect.left + unitRect.width / 2 - stageRect.left) / stageRect.width) * 100,
      y: ((unitRect.top - stageRect.top) / stageRect.height) * 100,
    });
  }, [timeElapseFx?.active, skippedTurnUnitId, battle?.actionLog?.length]);

  const isAttackerCandidate = (unit) => !!(
    unit
    && unit.alive
    && modelIsPlayerCommandable(unit)
    && !enemyConfirm
  );

  const isTargetCandidate = (unit, attacker = selectedAttacker) => !!(
    attacker
    && attacker.alive
    && unit
    && unit.alive
    && !enemyConfirm
    && modelIsManualTargetable(unit)
    && modelCanPlayerChooseTarget(battle, attacker, unit)
  );

  const canAttack = !!(
    selectedAttacker
    && selectedTarget
    && selectedAttacker.alive
    && selectedTarget.alive
    && battle?.status === "PLAYER_TURN"
    && !enemyConfirm
    && !activeSkillOverlay
    && isTargetCandidate(selectedTarget, selectedAttacker)
  );

  const registerNode = (id) => (node) => {
    if (node) {
      nodeRefs.current[id] = node;
    }
  };

  const queueSkillTimer = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    skillTimersRef.current.push(timer);
  };

  const clearSkillTimers = () => {
    skillTimersRef.current.forEach((timer) => clearTimeout(timer));
    skillTimersRef.current = [];
  };

  const findPointerUnit = (clientX, clientY, fallbackTarget = null) => {
    const target = fallbackTarget || (typeof document !== "undefined"
      ? document.elementFromPoint(clientX, clientY)
      : null);
    const button = target?.closest?.("[data-unit-id]");
    if (!button) {
      return null;
    }
    const unitId = button.getAttribute("data-unit-id");
    return allUnits.find((unit) => unit.id === unitId) || null;
  };

  const beginSpaceReorg = (skill) => {
    if (!(skill && battle?.status === "PLAYER_TURN" && !enemyConfirm)) {
      return;
    }
    clearSkillTimers();
    setSelectionNotice(null);
    setSelectedAttackerId(null);
    setSelectedTargetId(null);
    setSpaceReorg({
      active: true,
      casterId: "p-robot",
      skill,
      phase: "select-source",
      sourceId: null,
      targetId: null,
      chain: null,
      dragging: false,
      amountMin: 1,
      amountMax: 1,
      amountValue: 1,
      message: "请从需要减少 POWER 的单位拖向需要增加 POWER 的单位。",
      dragChain: null,
      sourceFloat: null,
      targetFloat: null,
      onAmountChange: null,
      onAmount: null,
    });
  };

  const finishSpaceReorg = () => {
    clearSkillTimers();
    setSpaceReorg(null);
  };

  const beginTimeElapse = (skill) => {
      if (!(skill && battle?.status === "PLAYER_TURN" && !enemyConfirm) || timeElapseFx?.active) {
        return;
      }
    clearSkillTimers();
    setSelectionNotice(null);
    setSelectedAttackerId(null);
    setSelectedTargetId(null);
      setTimeElapseFx({
        active: true,
        phase: "drop",
      });

      queueSkillTimer(() => {
        setTimeElapseFx((current) => current ? { ...current, phase: "turn-pop" } : current);
      }, 2800);

      queueSkillTimer(() => {
        onAction("time-elapse", {
          casterId: "p-robot",
        });
      }, 3650);

      queueSkillTimer(() => {
        setTimeElapseFx((current) => current ? { ...current, phase: "fade-out" } : current);
      }, 5000);

      queueSkillTimer(() => {
        setTimeElapseFx(null);
      }, 5900);
    };

  const executeSpaceReorg = (overlayState, amount) => {
    if (!overlayState?.sourceId || !overlayState?.targetId) {
      return;
    }
    const sourceUnit = allUnits.find((unit) => unit.id === overlayState.sourceId);
    const targetUnit = allUnits.find((unit) => unit.id === overlayState.targetId);
    if (!(sourceUnit && targetUnit)) {
      finishSpaceReorg();
      return;
    }

    const startedAt = Date.now();
    const sourceFloat = {
      from: sourceUnit.power,
      to: sourceUnit.power - amount,
      start: startedAt,
      duration: 3400,
      text: String(sourceUnit.power.toFixed(3)),
      style: { left: `calc(${overlayState.chain?.x1 || 50}% - 3rem)`, top: `calc(${overlayState.chain?.y1 || 50}% - 3.6rem)` },
    };
    const targetFloat = {
      from: targetUnit.power,
      to: targetUnit.power + amount,
      start: startedAt,
      duration: 3400,
      text: String(targetUnit.power.toFixed(3)),
      style: { left: `calc(${overlayState.chain?.x2 || 50}% - 3rem)`, top: `calc(${overlayState.chain?.y2 || 50}% - 3.6rem)` },
    };

    setSpaceReorg((current) => ({
      ...current,
      phase: "animating",
      message: "空间质正在重组，请稍候……",
      sourceFloat,
      targetFloat,
      dragging: false,
    }));

    queueSkillTimer(() => {
      return;
      const targetFloat = {
        from: targetUnit.power,
        to: targetUnit.power + amount,
        start: Date.now(),
        duration: 2600,
        text: String(targetUnit.power.toFixed(3)),
        style: { left: `calc(${overlayState.chain?.x2 || 50}% - 3rem)`, top: `calc(${overlayState.chain?.y2 || 50}% - 3.6rem)` },
      };
      setSpaceReorg((current) => current ? {
        ...current,
        message: "前段重组完成，正在将 POWER 重塑到目标单元。",
        targetFloat,
      } : current);
    }, 3400);

    queueSkillTimer(() => {
      setSpaceReorg((current) => current ? {
        ...current,
        phase: "release",
        message: "重组完成，正在解除共振场。",
      } : current);
    }, 3900);

    queueSkillTimer(() => {
      onAction("space-reorg", {
        casterId: overlayState.casterId,
        sourceId: overlayState.sourceId,
        targetId: overlayState.targetId,
        amount,
      });
      setInspectId(overlayState.targetId);
      finishSpaceReorg();
    }, 6200);
  };

  const handleSpaceReorgPointerDown = (event) => {
    if (!(spaceReorg?.active) || spaceReorg.phase === "amount" || spaceReorg.phase === "animating" || spaceReorg.phase === "release") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const unit = findPointerUnit(event.clientX, event.clientY, event.target);
    if (!(unit && unit.alive && (unit.baseSide ?? unit.side) === "player")) {
      return;
    }
    event.preventDefault();
    dragPointerRef.current = event.pointerId;
    setInspectId(unit.id);
    setSpaceReorg((current) => current ? {
      ...current,
      sourceId: unit.id,
      targetId: null,
      chain: null,
      dragChain: buildConnectionToPoint(unit.id, event.clientX, event.clientY),
      dragging: true,
      phase: "dragging",
      message: "拖到需要增加 POWER 的己方单位上，松开即可完成连接。",
    } : current);
  };

  const selectAttacker = (unit) => {
    setInspectId(unit.id);
    if (spaceReorg?.active) {
      return;
    }

    if (!isAttackerCandidate(unit)) {
      return;
    }
    if (selectedAttackerId === unit.id) {
      setSelectedAttackerId(null);
      setSelectedTargetId(null);
      return;
    }
    setSelectedAttackerId(unit.id);
    if (selectedTargetId === unit.id) {
      setSelectedTargetId(null);
    }
    if (modelHasLockedTarget(unit) && !modelGetForcedTargetId(battle, unit)) {
      setSelectionNotice("\u65e0\u53ef\u6307\u5b9a\u7684\u76ee\u6807");
    } else {
      setSelectionNotice(null);
    }
  };

  const selectTarget = (unit) => {
    setInspectId(unit.id);
    if (spaceReorg?.active) {
      return;
    }
    if (selectedAttacker && modelHasLockedTarget(selectedAttacker)) {
      if (!modelGetForcedTargetId(battle, selectedAttacker)) {
        setSelectionNotice("\u65e0\u53ef\u6307\u5b9a\u7684\u76ee\u6807");
      }
      return;
    }
    if (!isTargetCandidate(unit)) {
      return;
    }
    setSelectedTargetId(unit.id);
  };

  const selectEnemyRowUnit = (unit) => {
    setInspectId(unit.id);
    if (spaceReorg?.active) {
      return;
    }
    if (isAttackerCandidate(unit) && (!selectedAttacker || selectedAttacker.id !== unit.id)) {
      setSelectedAttackerId(unit.id);
      if (selectedTargetId === unit.id) {
        setSelectedTargetId(null);
      }
      if (modelHasLockedTarget(unit) && !modelGetForcedTargetId(battle, unit)) {
        setSelectionNotice("\u65e0\u53ef\u6307\u5b9a\u7684\u76ee\u6807");
      } else {
        setSelectionNotice(null);
      }
      return;
    }
    if (selectedAttacker && modelHasLockedTarget(selectedAttacker)) {
      if (!modelGetForcedTargetId(battle, selectedAttacker)) {
        setSelectionNotice("\u65e0\u53ef\u6307\u5b9a\u7684\u76ee\u6807");
      }
      return;
    }
    if (isTargetCandidate(unit)) {
      setSelectedTargetId(unit.id);
    }
  };

  const handleAttack = () => {
    if (!canAttack) {
      return;
    }
    onAction("attack", {
      attackerId: selectedAttacker.id,
      targetId: selectedTarget.id,
    });
    setInspectId(selectedTarget.id);
  };

  const handleConfirmEnemy = () => {
    onAction("confirm-enemy", {});
    setSelectedTargetId(null);
    setArrow(null);
  };

  const handleBack = () => {
    if (spaceReorg?.active) {
      finishSpaceReorg();
      return;
    }
    if (guideStep?.mode === "undo") {
      onAction("guide-undo", {});
      setSelectedTargetId(null);
      setArrow(null);
      return;
    }
    setSelectedTargetId(null);
    setArrow(null);
    onAction("undo", {});
  };

  const handleTipSelect = (item) => {
    if (item.status === "locked") {
      return;
    }
    if (item.status === "revealed") {
      setOpenTipId(item.id);
      return;
    }
    onAction("reveal-tip", { tipId: item.id });
    setOpenTipId(item.id);
  };

  return (
    <div className={`library-run-root ${rootBackground.rootClassName || ""}`.trim()} ref={rootRef}>
      <div className="scene-backdrop-stack" aria-hidden="true">
        {rootBackground.layers.map((layer, index) => (
          <div key={`${rootBackground.key}-${index}`} className={layer.className} />
        ))}
      </div>
      <audio ref={music.audioRef} hidden />
      <div className="battle-toolbar">
        {!isStoryPhase && !isModeSelectPhase ? (
          <>
            <div className="mini-status">Turn {displayTurn}</div>
            <button
              type="button"
              className={`mini-button ${hasHighlight(guideStep, "area", "toolbar-back") ? "guide-glow" : ""}`}
              onClick={handleBack}
            >
              BACK
            </button>
            <button
              type="button"
              className={`mini-button ${hasHighlight(guideStep, "area", "toolbar-rules") ? "guide-glow" : ""}`}
              onClick={() => setShowRules(true)}
            >
              RULES
            </button>
            <button
              type="button"
              className={`mini-button ${hasHighlight(guideStep, "area", "toolbar-tips") ? "guide-glow" : ""}`}
              onClick={() => setShowTips(true)}
            >
              TIPS
            </button>
            <button
              type="button"
              className={`mini-button ${hasHighlight(guideStep, "area", "toolbar-log") ? "guide-glow" : ""}`}
              onClick={() => setShowLog(true)}
            >
              LOG
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={`mini-button music-button ${music.isPlaying ? "strong" : ""}`}
          onClick={music.toggle}
          title={music.track ? `${music.track.source} / ${music.track.title}` : "BGM"}
        >
          {music.isPlaying ? <MusicPauseIcon /> : <MusicPlayIcon />}
        </button>
      </div>

      {music.notice ? (
        <button type="button" className="music-notice fade-in" onClick={() => music.setNotice(null)}>
          <div className="music-notice-kicker">NOW PLAYING</div>
          <div className="music-notice-title">{music.notice.title}</div>
          <div className="music-notice-copy">借用来源：{music.notice.source}</div>
          <div className="music-notice-copy">音频名称：{music.notice.title}</div>
          <div className="music-notice-copy">作者：{music.notice.credit}</div>
        </button>
      ) : null}

      {isStoryPhase ? (
        <StoryView gameState={gameState} onAction={onAction} />
      ) : isModeSelectPhase ? (
        <ModeSelectOverlay onPick={(mode) => onAction("select-mode", { mode })} />
      ) : (
        <div className="battle-shell">
          <div className="battle-layout">
              <section
                className={`stage-board ${spaceReorg?.active ? "space-reorg-active space-reorg-cursor" : ""}`.trim()}
                ref={stageRef}
                onPointerDownCapture={handleSpaceReorgPointerDown}
              >
              <SpaceReorgOverlay state={spaceReorg} />
              <TimeElapseOverlay
                state={timeElapseFx}
                enemyUnits={enemyUnits}
                playerUnits={playerUnits}
                gameState={gameState}
                centerFeed={centerFeed}
                skippedBadge={skippedTurnBadge}
              />
              <ArrowLayer arrow={spaceReorg?.active ? null : arrow} />
              <div className={`row enemy-row ${hasHighlight(guideStep, "area", "enemy-row") ? "guide-glow" : ""}`.trim()}>
                {enemyUnits.map((unit) => (
                  <UnitCell
                    key={unit.id}
                    unit={unit}
                    gameState={gameState}
                    inspected={inspectId === unit.id}
                    guideGlow={hasHighlight(guideStep, "unit", unit.id) || hasHighlight(guideStep, "area", "power-readout")}
                    attackerReady={isAttackerCandidate(unit)}
                    attackerSelected={selectedAttackerId === unit.id}
                    targetReady={isTargetCandidate(unit)}
                    targetSelected={selectedTargetId === unit.id}
                    friendlyAttacker={confirmAttackerId === unit.id && confirmControllerSide === "player"}
                    friendlyDefender={confirmDefenderId === unit.id && confirmControllerSide === "enemy"}
                    hostileAttacker={confirmAttackerId === unit.id && confirmControllerSide === "enemy"}
                    hostileDefender={confirmDefenderId === unit.id && confirmControllerSide === "player"}
                    onClick={() => selectEnemyRowUnit(unit)}
                    onCancelAttacker={selectedAttackerId === unit.id ? () => {
                      setSelectedAttackerId(null);
                      setSelectedTargetId(null);
                    } : null}
                    onCancelTarget={selectedTargetId === unit.id ? () => setSelectedTargetId(null) : null}
                    incomingBuffText={incomingAntibodyTargetId === unit.id ? "将要在攻击前获得抗体" : null}
                    spaceReorgSource={spaceReorg?.sourceId === unit.id}
                    spaceReorgTarget={spaceReorg?.targetId === unit.id}
                    virusStateOverride={getDisplayedVirusState(unit)}
                    timeSkipHighlight={skippedTurnUnitId === unit.id}
                    registerRef={registerNode(unit.id)}
                  />
                ))}
              </div>

              <div className={`stage-middle ${hasHighlight(guideStep, "area", "center-feed") ? "guide-glow" : ""}`.trim()}>
                {selectionNotice ? (
                  <div className="selection-notice fade-in">
                    {selectionNotice}
                  </div>
                ) : null}
                <div className="center-feed">
                  {centerFeed.map((item) => (
                    <div key={item.key} className={`feed-line ${item.type}`}>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`row player-row ${hasHighlight(guideStep, "area", "player-row") ? "guide-glow" : ""}`.trim()}>
                {playerUnits.map((unit) => {
                  const isDisguise = modelGetUnitDisplayMode(unit) === "split";
                  return (
                    <UnitCell
                      key={unit.id}
                      unit={unit}
                      gameState={gameState}
                      inspected={inspectId === unit.id}
                      guideGlow={hasHighlight(guideStep, "unit", unit.id) || hasHighlight(guideStep, "area", "power-readout")}
                      attackerReady={isAttackerCandidate(unit)}
                      attackerSelected={selectedAttackerId === unit.id}
                      targetReady={isDisguise && isTargetCandidate(unit)}
                      targetSelected={selectedTargetId === unit.id}
                      friendlyAttacker={confirmAttackerId === unit.id && confirmControllerSide === "player"}
                      friendlyDefender={confirmDefenderId === unit.id && confirmControllerSide === "enemy"}
                      hostileAttacker={confirmAttackerId === unit.id && confirmControllerSide === "enemy"}
                      hostileDefender={confirmDefenderId === unit.id && confirmControllerSide === "player"}
                      onClick={() => selectAttacker(unit)}
                      onTopClick={isDisguise ? () => selectTarget(unit) : null}
                      onBottomClick={isDisguise ? () => selectAttacker(unit) : null}
                      onCancelAttacker={selectedAttackerId === unit.id ? () => {
                        setSelectedAttackerId(null);
                        setSelectedTargetId(null);
                      } : null}
                      onCancelTarget={selectedTargetId === unit.id ? () => setSelectedTargetId(null) : null}
                      incomingBuffText={incomingAntibodyTargetId === unit.id ? "将要在攻击前获得抗体" : null}
                      spaceReorgSource={spaceReorg?.sourceId === unit.id}
                      spaceReorgTarget={spaceReorg?.targetId === unit.id}
                      virusStateOverride={getDisplayedVirusState(unit)}
                      timeSkipHighlight={skippedTurnUnitId === unit.id}
                      registerRef={registerNode(unit.id)}
                    />
                  );
                })}
              </div>
              <GuideCard step={guideStep} onNext={() => onAction("next-guide", {})} />
            </section>

            <SidePanel
              battle={displayBattle}
              selectedUnit={inspectedUnit}
              gameState={gameState}
              enemyConfirm={enemyConfirm}
              canAttack={canAttack}
              onAttack={handleAttack}
              onConfirmEnemy={handleConfirmEnemy}
              onUseActiveSkill={(skill) => {
                if (skill.key === "space-reorg") {
                  beginSpaceReorg(skill);
                  return;
                }
                if (skill.key === "time-elapse") {
                  beginTimeElapse(skill);
                }
              }}
                skillLocked={!!spaceReorg?.active || !!timeElapseFx?.active || !!enemyConfirm}
                guideStep={guideStep}
              />
          </div>
        </div>
      )}

      {!isStoryPhase && !isModeSelectPhase && showLog ? <LogOverlay battle={battle} onClose={() => setShowLog(false)} /> : null}
      {!isStoryPhase && !isModeSelectPhase && showRules ? <RulesOverlay rules={gameState.rulebook} onClose={() => setShowRules(false)} /> : null}
      {!isStoryPhase && !isModeSelectPhase && showTips ? <TipsOverlay items={tipItems} onSelect={handleTipSelect} onClose={() => setShowTips(false)} /> : null}
      {!isStoryPhase && !isModeSelectPhase && openTipItem ? <TipDetailOverlay item={openTipItem} onClose={() => setOpenTipId(null)} /> : null}
      {!isStoryPhase && !isModeSelectPhase && gameState.pendingDefeat ? (
        <FailureOverlay
          reason={gameState.pendingDefeat.reason}
          onUndo={() => onAction("undo", {})}
          onGiveUp={() => onAction("give-up", {})}
        />
      ) : null}
      {!isStoryPhase && !isModeSelectPhase && gameState.finalResults ? <ResultOverlay finalResults={gameState.finalResults} /> : null}
      <StyleBlock />
    </div>
  );
}

function StyleBlock() {
  return (
    <style jsx global>{`
      .library-run-root {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #def8ff;
        --library-run-available-height: 620px;
        background: linear-gradient(180deg, rgba(4, 16, 38, 0.96), rgba(3, 10, 25, 0.98));
      }

      .scene-backdrop-stack {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }

      body.library-run-hide-player .fixed.bottom-4.left-4.z-50 {
        display: none !important;
      }

      .story-shell {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        min-height: calc(100dvh - 220px);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 2.2rem 1.5rem 1rem;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
      }

      .story-backdrop {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .story-backdrop-default-base {
        background:
          radial-gradient(circle at 18% 16%, rgba(88, 205, 255, 0.14), transparent 28%),
          radial-gradient(circle at 82% 18%, rgba(53, 124, 255, 0.16), transparent 32%),
          linear-gradient(180deg, rgba(7, 16, 35, 0.96), rgba(4, 12, 28, 0.98));
      }

      .story-backdrop-default-glow {
        background:
          radial-gradient(circle at 50% 78%, rgba(86, 214, 255, 0.12), transparent 42%),
          radial-gradient(circle at 50% 0%, rgba(27, 80, 154, 0.18), transparent 48%);
        mix-blend-mode: screen;
      }

      .story-backdrop-default-gridwash {
        background:
          linear-gradient(135deg, rgba(116, 224, 255, 0.04), transparent 34%),
          linear-gradient(315deg, rgba(116, 224, 255, 0.03), transparent 38%);
      }

      .library-run-root.story-bg-memory .story-noise {
        opacity: 0.12;
        filter: grayscale(0.1) blur(0.08px);
      }

      .story-backdrop-memory-base {
        background: rgba(244, 248, 255, 0.04);
        backdrop-filter: grayscale(0.14) saturate(0.82) contrast(0.94) brightness(1.02) blur(0.8px);
      }

      .story-backdrop-memory-glow {
        background:
          radial-gradient(
            ellipse at center,
            rgba(255, 255, 255, 0) 0 46%,
            rgba(244, 248, 255, 0.08) 68%,
            rgba(255, 255, 255, 0.2) 100%
          );
        filter: blur(10px);
      }

      .story-backdrop-memory-vignette {
        background:
          radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.03), transparent 42%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(232, 240, 255, 0.03));
        mix-blend-mode: screen;
      }

      .library-run-root.story-bg-memory .story-index {
        color: rgba(226, 236, 255, 0.48);
      }

      .library-run-root.story-bg-memory .story-paragraph {
        color: rgba(239, 246, 255, 0.95);
        text-shadow: 0 0 18px rgba(220, 232, 255, 0.04);
      }

      .library-run-root.story-bg-memory .story-hint {
        color: rgba(218, 232, 255, 0.74);
      }

      .story-backdrop-blood-dark,
      .story-backdrop-blood-mid,
      .story-backdrop-blood-bright {
        opacity: 0;
        animation-fill-mode: forwards;
      }

      .story-backdrop-blood-dark {
        background:
          radial-gradient(circle at 18% 24%, rgba(66, 5, 9, 0.84) 0 10%, transparent 18%),
          radial-gradient(circle at 72% 16%, rgba(54, 6, 9, 0.72) 0 8%, transparent 15%),
          radial-gradient(circle at 56% 66%, rgba(72, 8, 11, 0.78) 0 14%, transparent 23%),
          linear-gradient(180deg, rgba(25, 3, 7, 0.96), rgba(12, 2, 5, 0.98));
        animation: blood-layer-dark 540ms ease forwards;
      }

      .story-backdrop-blood-mid {
        background:
          radial-gradient(circle at 22% 26%, rgba(161, 22, 30, 0.48) 0 14%, transparent 22%),
          radial-gradient(circle at 78% 18%, rgba(173, 28, 36, 0.42) 0 11%, transparent 18%),
          radial-gradient(circle at 58% 70%, rgba(184, 32, 38, 0.4) 0 17%, transparent 24%),
          radial-gradient(circle at 36% 58%, rgba(158, 24, 31, 0.26) 0 10%, transparent 18%);
        animation: blood-layer-mid 620ms ease 220ms forwards;
      }

      .story-backdrop-blood-bright {
        background:
          radial-gradient(circle at 24% 28%, rgba(255, 74, 74, 0.34) 0 15%, transparent 22%),
          radial-gradient(circle at 80% 20%, rgba(255, 88, 88, 0.28) 0 12%, transparent 18%),
          radial-gradient(circle at 60% 72%, rgba(255, 92, 92, 0.3) 0 18%, transparent 24%),
          radial-gradient(circle at 40% 60%, rgba(255, 110, 110, 0.16) 0 12%, transparent 18%);
        animation: blood-layer-bright 660ms ease 460ms forwards;
      }

      .library-run-root.story-bg-bloodflash .story-index {
        color: rgba(255, 214, 214, 0.58);
      }

      .library-run-root.story-bg-bloodflash .story-paragraph {
        color: rgba(255, 240, 240, 0.96);
      }

      .library-run-root.story-bg-bloodflash .story-hint {
        color: rgba(255, 196, 196, 0.78);
      }

      @keyframes blood-layer-dark {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes blood-layer-mid {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes blood-layer-bright {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .story-noise {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.45;
        background-image:
          linear-gradient(rgba(110, 226, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(110, 226, 255, 0.05) 1px, transparent 1px);
        background-size: 44px 44px;
      }

      .story-page {
        position: relative;
        width: min(980px, 100%);
        min-height: calc(100dvh - 280px);
        padding: 0.2rem 0.2rem 2rem;
      }

      .story-page.tone-red .story-paragraph {
        color: rgba(255, 122, 122, 0.96);
        text-shadow: 0 0 18px rgba(255, 72, 72, 0.2);
      }

      .story-page.tone-red .story-hint,
      .story-page.tone-red .story-index {
        color: rgba(255, 190, 190, 0.68);
      }

      .story-index {
        position: absolute;
        top: 0;
        right: 0;
        font-size: 0.72rem;
        letter-spacing: 0.32em;
        color: rgba(171, 232, 255, 0.4);
      }

      .story-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 860px;
        margin: 0 auto;
        padding-top: 1.8rem;
      }

      .story-paragraph {
        margin: 0;
        font-size: clamp(1rem, 1.55vw, 1.18rem);
        line-height: 1.92;
        color: rgba(236, 248, 255, 0.95);
        user-select: none;
        -webkit-user-select: none;
      }

      .story-hint {
        position: absolute;
        right: 0;
        bottom: 0;
        font-size: 0.68rem;
        letter-spacing: 0.12em;
        color: rgba(147, 224, 255, 0.72);
      }

      .battle-toolbar {
        position: absolute;
        top: 0.65rem;
        right: 0.8rem;
        z-index: 14;
        display: flex;
        gap: 0.45rem;
        align-items: center;
      }

      .mini-status {
        min-width: 4.15rem;
        height: 2.3rem;
        padding: 0 0.9rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(123, 218, 255, 0.18);
        background: rgba(6, 20, 42, 0.74);
        color: rgba(214, 242, 255, 0.88);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
      }

      .music-button {
        min-width: 2.55rem;
        width: 2.55rem;
        height: 2.55rem;
        padding: 0;
      }

      .music-icon {
        width: 1.05rem;
        height: 1.05rem;
      }

      .music-notice {
        position: absolute;
        top: 1rem;
        left: 50%;
        z-index: 18;
        transform: translateX(-50%);
        width: min(460px, calc(100% - 2rem));
        padding: 0.85rem 1rem;
        border-radius: 20px;
        border: 1px solid rgba(134, 231, 255, 0.34);
        background: linear-gradient(180deg, rgba(5, 18, 41, 0.95), rgba(8, 25, 55, 0.92));
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.35),
          0 0 32px rgba(73, 194, 255, 0.18);
        text-align: center;
        cursor: pointer;
        appearance: none;
        outline: none;
      }

      .music-notice-kicker {
        font-size: 0.68rem;
        letter-spacing: 0.22em;
        color: rgba(143, 228, 255, 0.72);
      }

      .music-notice-title {
        margin-top: 0.25rem;
        font-size: 1rem;
        font-weight: 700;
        color: rgba(240, 250, 255, 0.98);
      }

      .music-notice-copy {
        margin-top: 0.18rem;
        font-size: 0.76rem;
        color: rgba(214, 241, 255, 0.82);
      }

      .battle-shell {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        min-height: 0;
        height: var(--library-run-available-height);
        padding: 2.8rem 0.8rem 0.75rem;
      }

      .battle-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 318px;
        gap: 0.8rem;
        width: 100%;
        height: 100%;
        min-height: 0;
      }

      .stage-board {
        position: relative;
        isolation: isolate;
        min-height: 0;
        height: 100%;
        display: grid;
        grid-template-rows: max-content minmax(84px, 1fr) max-content;
        gap: 0.65rem;
        padding: 0.25rem 0.15rem 0.1rem;
      }

      .stage-board.space-reorg-cursor {
        cursor: crosshair;
      }

      .row {
        position: relative;
        z-index: 6;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        gap: 0.8rem;
        min-height: 0;
        padding: 0.2rem 0.4rem;
        border-radius: 24px;
      }

      .player-row {
        align-self: end;
      }

      .stage-middle {
        position: relative;
        z-index: 6;
        min-height: 84px;
        border-radius: 24px;
      }

      .guide-glow {
        outline: 2px solid rgba(132, 233, 255, 0.54);
        outline-offset: 2px;
        box-shadow:
          inset 0 0 0 1px rgba(127, 227, 255, 0.36),
          0 0 34px rgba(70, 180, 255, 0.2),
          0 0 0 1px rgba(129, 228, 255, 0.18);
        background: rgba(13, 36, 72, 0.34);
      }

      .guide-glow-inline {
        border-radius: 16px;
        box-shadow:
          inset 0 0 0 1px rgba(127, 227, 255, 0.42),
          0 0 18px rgba(64, 182, 255, 0.16);
      }

      .guide-glow-inline.blockish {
        padding: 0.35rem 0.45rem;
      }

      .battle-arrow {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 8;
        overflow: visible;
      }

      .battle-arrow line {
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        filter: drop-shadow(0 0 12px currentColor);
      }

      .battle-arrow.dashed line {
        stroke-dasharray: 6 5;
      }

      .battle-arrow.friendly {
        color: rgba(109, 232, 255, 0.96);
      }

      .battle-arrow.hostile {
        color: rgba(255, 150, 106, 0.96);
      }

      .motion-link-layer {
        position: absolute;
        inset: 0;
        z-index: 12;
        pointer-events: none;
      }

      .motion-link-core,
      .motion-link-trace {
        position: absolute;
        height: 8px;
        border-radius: 999px;
        transform-origin: left center;
      }

      .motion-link-core {
        background: linear-gradient(
          90deg,
          rgba(250, 252, 255, 0.96) 0%,
          rgba(232, 242, 255, 0.98) 52%,
          rgba(250, 252, 255, 0.96) 100%
        );
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.24),
          0 0 10px rgba(210, 232, 255, 0.18);
      }

      .motion-link-trace {
        opacity: 0;
        background:
          linear-gradient(
            90deg,
            rgba(255, 224, 118, 0) 0%,
            rgba(255, 224, 118, 0) 36%,
            rgba(255, 214, 92, 0.96) 47%,
            rgba(255, 247, 214, 0.98) 54%,
            rgba(255, 214, 92, 0.94) 62%,
            rgba(255, 224, 118, 0) 74%,
            rgba(255, 224, 118, 0) 100%
          );
        background-size: 220% 100%;
        box-shadow:
          0 0 18px rgba(255, 236, 162, 0.36),
          0 0 28px rgba(255, 236, 162, 0.22);
      }

      .motion-link-layer.dragging .motion-link-trace {
        opacity: 0.78;
        animation: motion-link-pulse 1.6s linear infinite;
      }

      .motion-link-layer.amount .motion-link-trace {
        opacity: 1;
        clip-path: inset(0 0 0 0);
        animation: motion-link-pulse 1.6s linear infinite;
      }

      .motion-link-layer.animating .motion-link-trace {
        opacity: 1;
        clip-path: inset(0 100% 0 0);
        animation:
          motion-link-pulse 1.1s linear infinite,
          motion-link-fill 3.1s ease forwards;
      }

      .motion-link-layer.release .motion-link-trace {
        opacity: 1;
        clip-path: inset(0 0 0 0);
        animation:
          motion-link-pulse 1.1s linear infinite,
          motion-link-release 2.1s ease forwards;
      }

      .center-feed {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(320px, calc(100% - 1rem));
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        z-index: 4;
        pointer-events: none;
      }

      .selection-notice {
        position: absolute;
        left: 50%;
        top: calc(50% - 2.4rem);
        transform: translateX(-50%);
        z-index: 6;
        padding: 0.46rem 0.92rem;
        border-radius: 14px;
        border: 1px solid rgba(255, 183, 123, 0.54);
        background: rgba(88, 26, 8, 0.9);
        color: rgba(255, 232, 213, 0.96);
        font-size: 0.8rem;
        letter-spacing: 0.04em;
        text-align: center;
        box-shadow:
          0 0 0 1px rgba(255, 205, 158, 0.18),
          0 0 24px rgba(255, 112, 64, 0.26);
        pointer-events: none;
      }

      .overlay-card.tips-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .overlay-card.log-card {
        overflow: hidden;
      }

      .overlay-card.rules-card {
        overflow: hidden;
      }

      .tips-list,
      .tip-detail-copy,
      .log-list,
      .rules-list {
        margin-top: 0.8rem;
        max-height: min(60vh, 520px);
        overflow-y: auto;
        padding-right: 0.16rem;
        padding-bottom: 0.42rem;
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: rgba(118, 215, 255, 0.78) rgba(10, 26, 52, 0.34);
      }

      .tips-list {
        display: block;
      }

      .tip-row {
        appearance: none;
        font: inherit;
        line-height: 1.45;
        position: relative;
        display: grid;
        grid-template-columns: 2.4rem minmax(0, 1fr);
        align-items: center;
        gap: 0.56rem;
        width: 100%;
        min-height: 3.28rem;
        margin: 0 0 0.52rem;
        padding: 0.44rem 0.68rem;
        border-radius: 16px;
        border: 1px solid rgba(124, 219, 255, 0.16);
        background: rgba(8, 23, 45, 0.72);
        color: rgba(232, 247, 255, 0.92);
        text-align: left;
        overflow: hidden;
      }

      .tip-row:last-child {
        margin-bottom: 0;
      }

      .tip-row::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(
            -58deg,
            rgba(255, 255, 255, 0.055) 0 10px,
            rgba(255, 255, 255, 0.015) 10px 20px
          );
        opacity: 0.72;
        pointer-events: none;
      }

      .tip-row > * {
        position: relative;
        z-index: 1;
      }

      .tip-row.available {
        border-color: rgba(126, 220, 255, 0.24);
        background: rgba(10, 28, 54, 0.84);
        cursor: pointer;
      }

      .tip-row.revealed {
        border-color: rgba(114, 244, 165, 0.3);
        background: rgba(11, 44, 31, 0.82);
        color: rgba(226, 255, 240, 0.96);
        cursor: pointer;
      }

      .tip-row.locked {
        opacity: 0.66;
        cursor: default;
        grid-template-columns: 2.4rem;
        justify-content: center;
        min-height: 2.7rem;
      }

      .tip-row.locked .tip-text {
        display: none;
      }

      .tip-row.revealed::before {
        background:
          repeating-linear-gradient(
            -58deg,
            rgba(142, 255, 187, 0.085) 0 10px,
            rgba(142, 255, 187, 0.025) 10px 20px
          );
      }

      .tip-index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        border: 1px solid rgba(125, 220, 255, 0.16);
        background: rgba(15, 34, 60, 0.78);
        color: rgba(167, 225, 255, 0.72);
        font-size: 0.72rem;
      }

      .tip-row.revealed .tip-index {
        border-color: rgba(114, 244, 165, 0.3);
        background: rgba(13, 58, 39, 0.88);
        color: rgba(164, 255, 198, 0.92);
        box-shadow: 0 0 14px rgba(78, 214, 138, 0.16);
      }

      .tip-text {
        font-size: 0.78rem;
        line-height: 1.54;
        white-space: pre-wrap;
      }

      .tip-detail-copy {
        white-space: pre-wrap;
        font-size: 0.84rem;
        line-height: 1.82;
        color: rgba(230, 247, 255, 0.92);
      }

      .feed-line {
        max-width: 100%;
        padding: 0.28rem 0.64rem;
        border-radius: 999px;
        border: 1px solid rgba(124, 219, 255, 0.16);
        background: rgba(4, 16, 38, 0.82);
        font-size: 0.72rem;
        color: rgba(229, 247, 255, 0.9);
        text-align: center;
        backdrop-filter: blur(10px);
      }

      .feed-line.enemy {
        border-color: rgba(255, 165, 128, 0.18);
      }

      .feed-line.hook,
      .feed-line.skill {
        color: rgba(192, 236, 255, 0.78);
      }

      .guide-card {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 10;
        width: min(420px, calc(100% - 380px));
        padding: 0.95rem 1.05rem;
        border-radius: 22px;
        border: 1px solid rgba(138, 230, 255, 0.38);
        box-shadow:
          0 0 0 1px rgba(141, 233, 255, 0.22),
          0 18px 40px rgba(0, 0, 0, 0.32),
          0 0 42px rgba(72, 187, 255, 0.18);
        background:
          linear-gradient(180deg, rgba(8, 22, 48, 0.985), rgba(5, 16, 36, 0.975));
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .guide-card.side {
        left: auto;
        right: -5rem;
        top: 50%;
        transform: translateY(-50%);
        width: min(360px, calc(100% - 380px));
      }

      .guide-speaker {
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        color: rgba(136, 226, 255, 0.7);
        text-rendering: geometricPrecision;
      }

      .guide-text {
        margin: 0.4rem 0 0;
        font-size: 0.82rem;
        line-height: 1.72;
        color: rgba(231, 248, 255, 0.92);
        text-rendering: geometricPrecision;
      }

      .guide-hint {
        margin-top: 0.55rem;
        font-size: 0.72rem;
        color: rgba(153, 228, 255, 0.68);
        text-rendering: geometricPrecision;
      }

      .guide-callouts {
        display: flex;
        flex-direction: column;
        gap: 0.34rem;
        margin-top: 0.58rem;
      }

      .guide-callout {
        padding: 0.32rem 0.5rem;
        border-radius: 14px;
        border: 1px solid rgba(138, 231, 255, 0.28);
        background: rgba(18, 47, 87, 0.42);
        color: rgba(227, 247, 255, 0.92);
        font-size: 0.74rem;
        line-height: 1.5;
        text-rendering: geometricPrecision;
      }

      .unit-cell {
        position: relative;
        flex: 0 0 104px;
        width: 104px;
        height: 136px;
        transition: transform 160ms ease, opacity 160ms ease;
        z-index: 5;
      }

      .space-reorg-aura {
        position: absolute;
        inset: -6px;
        z-index: 0;
        border-radius: 26px;
        pointer-events: none;
      }

      .space-reorg-aura.source {
        background:
          linear-gradient(135deg, rgba(255, 214, 86, 0.72), rgba(121, 189, 255, 0.3) 48%, rgba(255, 218, 94, 0.82));
        box-shadow:
          0 0 22px rgba(255, 217, 102, 0.26),
          0 0 26px rgba(106, 176, 255, 0.18);
      }

      .space-reorg-aura.target {
        background:
          linear-gradient(135deg, rgba(110, 183, 255, 0.78), rgba(255, 217, 102, 0.26) 48%, rgba(104, 175, 255, 0.9));
        box-shadow:
          0 0 22px rgba(103, 178, 255, 0.24),
          0 0 26px rgba(255, 217, 102, 0.16);
      }

      .unit-cell:hover {
        transform: translateY(-3px);
      }

      .unit-cell.dead {
        opacity: 0.24;
        pointer-events: none;
      }

      .unit-shell {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        border-radius: 20px;
        border: 1px solid rgba(116, 161, 197, 0.16);
        background: rgba(61, 82, 102, 0.16);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        overflow: hidden;
      }

      .space-reorg-inner {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }

      .space-reorg-inner::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
      }

      .space-reorg-inner::after {
        content: "";
        position: absolute;
        inset: 16% 14%;
        border-radius: 18px;
        background: radial-gradient(circle at 50% 50%, rgba(7, 14, 28, 0.86), rgba(7, 14, 28, 0.12) 72%, rgba(7, 14, 28, 0) 100%);
      }

      .space-reorg-inner.source::before {
        background:
          linear-gradient(145deg, rgba(255, 224, 122, 0.38), rgba(106, 176, 255, 0.12) 44%, rgba(255, 224, 122, 0.48)),
          linear-gradient(325deg, rgba(110, 183, 255, 0.24), rgba(255, 224, 122, 0) 52%);
      }

      .space-reorg-inner.target::before {
        background:
          linear-gradient(145deg, rgba(110, 183, 255, 0.42), rgba(255, 224, 122, 0.1) 44%, rgba(110, 183, 255, 0.5)),
          linear-gradient(325deg, rgba(255, 224, 122, 0.24), rgba(110, 183, 255, 0) 52%);
      }

      .stage-board.space-reorg-active .unit-shell {
        background: rgba(9, 18, 34, 0.92);
        border-color: rgba(161, 193, 219, 0.24);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          0 0 0 1px rgba(4, 10, 20, 0.18);
      }

      .unit-cell.inspected .unit-shell {
        background: rgba(8, 20, 40, 0.9);
      }

      .unit-cell.attacker-ready .unit-shell {
        border-color: rgba(122, 215, 255, 0.36);
        background: rgba(98, 193, 255, 0.12);
      }

      .unit-cell.attacker-selected .unit-shell {
        border-color: rgba(120, 228, 255, 0.82);
        background: rgba(0, 67, 110, 0.96);
        box-shadow: 0 0 26px rgba(67, 196, 255, 0.28);
      }

      .unit-cell.target-ready .unit-shell {
        border-color: rgba(255, 179, 128, 0.34);
        background: rgba(255, 150, 84, 0.12);
      }

      .unit-cell.target-selected .unit-shell {
        border-color: rgba(255, 172, 118, 0.82);
        background: rgba(102, 42, 12, 0.96);
        box-shadow: 0 0 26px rgba(255, 137, 76, 0.28);
      }

      .unit-cell.friendly-attacker .unit-shell,
      .unit-cell.friendly-defender .unit-shell {
        border-color: rgba(120, 228, 255, 0.82);
        background: rgba(0, 67, 110, 0.96);
        box-shadow: 0 0 26px rgba(67, 196, 255, 0.28);
      }

      .unit-cell.hostile-attacker .unit-shell,
      .unit-cell.hostile-defender .unit-shell {
        border-color: rgba(255, 172, 118, 0.82);
        background: rgba(102, 42, 12, 0.96);
        box-shadow: 0 0 26px rgba(255, 137, 76, 0.28);
      }

      .unit-cell.time-skip-highlight .unit-shell {
        border-color: rgba(255, 221, 132, 0.84);
        background:
          linear-gradient(180deg, rgba(62, 49, 18, 0.96), rgba(20, 27, 44, 0.94));
        box-shadow:
          0 0 0 1px rgba(255, 236, 190, 0.36),
          0 0 28px rgba(255, 212, 102, 0.28),
          0 0 48px rgba(118, 180, 255, 0.12);
        animation: time-skip-highlight 1.45s ease-in-out infinite alternate;
      }

      .stage-board.space-reorg-active .unit-cell.attacker-ready .unit-shell,
      .stage-board.space-reorg-active .unit-cell.target-ready .unit-shell,
      .stage-board.space-reorg-active .unit-cell.inspected .unit-shell {
        background: rgba(9, 18, 34, 0.94);
      }

      .stage-board.space-reorg-active .unit-cell.attacker-selected .unit-shell,
      .stage-board.space-reorg-active .unit-cell.friendly-attacker .unit-shell,
      .stage-board.space-reorg-active .unit-cell.friendly-defender .unit-shell {
        background: rgba(0, 63, 104, 0.98);
      }

      .stage-board.space-reorg-active .unit-cell.target-selected .unit-shell,
      .stage-board.space-reorg-active .unit-cell.hostile-attacker .unit-shell,
      .stage-board.space-reorg-active .unit-cell.hostile-defender .unit-shell {
        background: rgba(102, 42, 12, 0.98);
      }

      .unit-button {
        position: absolute;
        inset: 0;
        z-index: 1;
        border: none;
        background: transparent;
        cursor: pointer;
      }

      .disguise-shell {
        background: rgba(8, 18, 37, 0.9);
      }

      .stage-board.space-reorg-active .disguise-shell {
        background: rgba(7, 15, 30, 0.96);
      }

      .segment-button {
        position: absolute;
        left: 0;
        width: 100%;
        height: 50%;
        z-index: 1;
        border: none;
        cursor: pointer;
        background: transparent;
      }

      .segment-button.top {
        top: 0;
        background: linear-gradient(180deg, rgba(255, 178, 132, 0.12), rgba(255, 128, 70, 0.14));
      }

      .stage-board.space-reorg-active .segment-button.top {
        background: linear-gradient(180deg, rgba(255, 178, 132, 0.08), rgba(255, 128, 70, 0.09));
      }

      .segment-button.bottom {
        bottom: 0;
        background: linear-gradient(180deg, rgba(147, 220, 255, 0.12), rgba(64, 153, 255, 0.18));
      }

      .stage-board.space-reorg-active .segment-button.bottom {
        background: linear-gradient(180deg, rgba(147, 220, 255, 0.08), rgba(64, 153, 255, 0.1));
      }

      .segment-button.top.target-ready {
        box-shadow: inset 0 0 0 1px rgba(255, 178, 128, 0.34);
      }

      .segment-button.top.target-selected {
        box-shadow: inset 0 0 0 1px rgba(255, 178, 118, 0.82), inset 0 0 26px rgba(255, 133, 79, 0.28);
        background: linear-gradient(180deg, rgba(95, 32, 7, 0.98), rgba(124, 45, 8, 0.95));
      }

      .segment-button.bottom.attacker-ready {
        box-shadow: inset 0 0 0 1px rgba(127, 223, 255, 0.32);
      }

      .segment-button.bottom.attacker-selected {
        box-shadow: inset 0 0 0 1px rgba(118, 230, 255, 0.82), inset 0 0 26px rgba(67, 189, 255, 0.28);
        background: linear-gradient(180deg, rgba(0, 62, 105, 0.97), rgba(0, 90, 139, 0.94));
      }

      .disguise-cell.friendly-attacker .segment-button.bottom,
      .disguise-cell.friendly-attacker .segment-button.top,
      .disguise-cell.friendly-defender .segment-button.bottom,
      .disguise-cell.friendly-defender .segment-button.top {
        box-shadow: inset 0 0 0 1px rgba(118, 230, 255, 0.82), inset 0 0 26px rgba(67, 189, 255, 0.24);
      }

      .disguise-cell.hostile-attacker .segment-button.bottom,
      .disguise-cell.hostile-attacker .segment-button.top,
      .disguise-cell.hostile-defender .segment-button.bottom,
      .disguise-cell.hostile-defender .segment-button.top {
        box-shadow: inset 0 0 0 1px rgba(255, 178, 118, 0.82), inset 0 0 26px rgba(255, 133, 79, 0.24);
      }

      .cell-meta {
        position: relative;
        z-index: 2;
        height: 100%;
        padding: 0.44rem 0.34rem 0.52rem;
        pointer-events: none;
      }

      .unit-power-line {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 0.24rem;
        position: relative;
      }

      .power-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.12rem;
        height: 1.12rem;
        margin-bottom: 0.24rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 122, 122, 0.82);
        font-size: 0.82rem;
        line-height: 1;
        color: rgba(255, 104, 104, 0.96);
        background: rgba(96, 10, 18, 0.28);
        text-shadow: 0 0 12px rgba(255, 62, 62, 0.34);
        box-shadow:
          inset 0 0 0 1px rgba(255, 190, 190, 0.08),
          0 0 14px rgba(255, 72, 72, 0.18);
      }

      .power-label {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.5rem;
        letter-spacing: 0.22em;
        color: rgba(182, 234, 255, 0.56);
      }

      .power-value {
        margin-top: 0.54rem;
        font-size: 2.1rem;
        line-height: 1;
        font-weight: 800;
        color: rgba(240, 251, 255, 0.98);
        text-shadow: 0 0 18px rgba(98, 222, 255, 0.32);
      }

      .power-suffix {
        margin-bottom: 0.18rem;
        font-size: 0.82rem;
        color: rgba(183, 230, 255, 0.54);
      }

      .unit-name {
        margin-top: 0.34rem;
        font-size: 0.72rem;
        line-height: 1.34;
        text-align: center;
        color: rgba(232, 247, 255, 0.92);
      }

      .unit-tags,
      .unit-buffs {
        display: flex;
        justify-content: center;
        gap: 0.26rem;
        flex-wrap: wrap;
        margin-top: 0.24rem;
      }

      .unit-buffs {
        margin-top: 0.18rem;
        min-height: 1.34rem;
        align-content: flex-start;
      }

      .tag-chip,
      .buff-chip,
      .mini-button,
      .action-button {
        border: 1px solid rgba(124, 219, 255, 0.2);
      }

      .tag-chip {
        min-width: 1.18rem;
        height: 1.18rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        font-size: 0.66rem;
        color: rgba(230, 247, 255, 0.9);
        background: rgba(106, 197, 255, 0.12);
      }

      .tag-chip.large {
        min-width: 1.56rem;
        height: 1.56rem;
      }

      .buff-chip {
        padding: 0.08rem 0.34rem;
        border-radius: 999px;
        font-size: 0.56rem;
        color: rgba(255, 216, 168, 0.92);
        background: rgba(255, 125, 66, 0.12);
      }

      .description-line + .description-line {
        margin-top: 0.24rem;
      }

      .cancel-chip {
        position: absolute;
        top: 0.26rem;
        right: 0.26rem;
        z-index: 4;
        width: 1rem;
        height: 1rem;
        border: none;
        border-radius: 999px;
        background: rgba(4, 11, 22, 0.8);
        color: rgba(240, 249, 255, 0.94);
        font-size: 0.74rem;
        line-height: 1;
        cursor: pointer;
      }

      .cancel-chip.bottom {
        top: auto;
        bottom: 0.24rem;
      }

      .incoming-buff-callout {
        position: absolute;
        inset: 0.22rem;
        z-index: 3;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 0.34rem 0.3rem;
        border-radius: 16px;
        border: 1px solid rgba(255, 212, 142, 0.58);
        background: rgba(77, 44, 8, 0.12);
        color: rgba(255, 232, 193, 0.96);
        font-size: 0.54rem;
        line-height: 1.35;
        text-align: center;
        box-shadow: inset 0 0 0 1px rgba(255, 242, 211, 0.08);
        pointer-events: none;
      }

      .side-panel {
        min-height: 0;
        height: 100%;
        display: grid;
        grid-template-rows: minmax(0, 4fr) minmax(0, 6fr) auto;
        gap: 0.78rem;
      }

      .panel-card {
        border-radius: 22px;
        border: 1px solid rgba(130, 221, 255, 0.16);
        background: rgba(5, 16, 36, 0.78);
        backdrop-filter: blur(16px);
        padding: 0.85rem;
      }

      .script-card {
        border-color: rgba(255, 158, 110, 0.18);
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .detail-card {
        min-height: 0;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(118, 215, 255, 0.78) rgba(10, 26, 52, 0.34);
      }

      .panel-kicker {
        margin-bottom: 0.28rem;
        font-size: 0.68rem;
        letter-spacing: 0.16em;
        color: rgba(148, 224, 255, 0.58);
      }

      .panel-title {
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: rgba(239, 250, 255, 0.96);
      }

      .panel-subtitle {
        margin-top: 0.9rem;
        margin-bottom: 0.42rem;
        font-size: 0.76rem;
        letter-spacing: 0.18em;
        color: rgba(138, 227, 255, 0.72);
      }

      .panel-copy {
        margin: 0.32rem 0 0;
        font-size: 0.78rem;
        line-height: 1.62;
        color: rgba(221, 243, 255, 0.84);
      }

      .panel-copy.dim {
        color: rgba(183, 222, 241, 0.58);
      }

      .panel-copy.context-line {
        display: flex;
        gap: 0.45rem;
        align-items: baseline;
        padding: 0.28rem 0.46rem;
        border-radius: 14px;
        border: 1px solid rgba(136, 228, 255, 0.2);
        background: rgba(19, 49, 86, 0.28);
        color: rgba(231, 248, 255, 0.9);
      }

      .context-key {
        color: rgba(150, 227, 255, 0.66);
        white-space: nowrap;
      }

      .panel-copy.mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }

      .script-lines {
        margin-top: 0.2rem;
        min-height: 0;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 170, 123, 0.84) rgba(40, 18, 16, 0.3);
      }

      .detail-card::-webkit-scrollbar,
      .log-list::-webkit-scrollbar,
      .rules-list::-webkit-scrollbar,
      .script-lines::-webkit-scrollbar,
      .tips-list::-webkit-scrollbar,
      .tip-detail-copy::-webkit-scrollbar {
        width: 8px;
      }

      .detail-card::-webkit-scrollbar-track,
      .log-list::-webkit-scrollbar-track,
      .rules-list::-webkit-scrollbar-track,
      .script-lines::-webkit-scrollbar-track,
      .tips-list::-webkit-scrollbar-track,
      .tip-detail-copy::-webkit-scrollbar-track {
        border-radius: 999px;
        background: rgba(6, 20, 42, 0.18);
        box-shadow: inset 0 0 0 1px rgba(134, 220, 255, 0.08);
      }

      .detail-card::-webkit-scrollbar-thumb,
      .log-list::-webkit-scrollbar-thumb,
      .rules-list::-webkit-scrollbar-thumb,
      .script-lines::-webkit-scrollbar-thumb,
      .tips-list::-webkit-scrollbar-thumb,
      .tip-detail-copy::-webkit-scrollbar-thumb {
        border-radius: 999px;
        border: 1px solid rgba(5, 16, 36, 0.68);
        background-clip: padding-box;
        transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }

      .detail-card::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(132, 226, 255, 0.92), rgba(58, 146, 255, 0.74));
        box-shadow: 0 0 10px rgba(66, 181, 255, 0.2);
      }

      .log-list::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(132, 226, 255, 0.92), rgba(58, 146, 255, 0.74));
        box-shadow: 0 0 10px rgba(66, 181, 255, 0.2);
      }

      .rules-list::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(132, 226, 255, 0.92), rgba(58, 146, 255, 0.74));
        box-shadow: 0 0 10px rgba(66, 181, 255, 0.2);
      }

      .script-lines::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(255, 188, 142, 0.94), rgba(255, 124, 84, 0.72));
        box-shadow: 0 0 10px rgba(255, 142, 101, 0.18);
      }

      .tips-list::-webkit-scrollbar-thumb,
      .tip-detail-copy::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(132, 226, 255, 0.92), rgba(58, 146, 255, 0.74));
        box-shadow: 0 0 10px rgba(66, 181, 255, 0.2);
      }

      .detail-card:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(155, 235, 255, 0.96), rgba(76, 171, 255, 0.82));
      }

      .log-list:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(155, 235, 255, 0.96), rgba(76, 171, 255, 0.82));
      }

      .rules-list:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(155, 235, 255, 0.96), rgba(76, 171, 255, 0.82));
      }

      .script-lines:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(255, 203, 165, 0.96), rgba(255, 145, 96, 0.8));
      }

      .tips-list:hover::-webkit-scrollbar-thumb,
      .tip-detail-copy:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(155, 235, 255, 0.96), rgba(76, 171, 255, 0.82));
      }

      .detail-card::-webkit-scrollbar-corner,
      .log-list::-webkit-scrollbar-corner,
      .rules-list::-webkit-scrollbar-corner,
      .script-lines::-webkit-scrollbar-corner,
      .tips-list::-webkit-scrollbar-corner,
      .tip-detail-copy::-webkit-scrollbar-corner {
        background: transparent;
      }

      .detail-head {
        display: flex;
        justify-content: space-between;
        gap: 0.9rem;
        align-items: flex-start;
      }

      .side-tags {
        margin-top: 0.36rem;
        justify-content: flex-start;
      }

      .side-power {
        display: flex;
        align-items: flex-end;
        gap: 0.2rem;
      }

      .side-power-main {
        font-size: 2.4rem;
        line-height: 1;
        font-weight: 800;
        color: #effbff;
      }

      .side-power-suffix {
        margin-bottom: 0.32rem;
        color: rgba(188, 232, 255, 0.54);
      }

      .skill-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.44rem;
      }

      .skill-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        padding: 0.72rem 0.9rem;
        border-radius: 18px;
      }

      .skill-button.used {
        background: rgba(78, 99, 118, 0.18);
        opacity: 0.62;
      }

      .skill-badge {
        font-size: 0.68rem;
        color: rgba(181, 229, 251, 0.66);
        white-space: nowrap;
      }

      .mini-button,
      .action-button {
        appearance: none;
        border-radius: 999px;
        background: rgba(111, 197, 255, 0.08);
        color: rgba(230, 247, 255, 0.9);
        cursor: pointer;
        transition: 160ms ease;
      }

      .mini-button {
        padding: 0.46rem 0.72rem;
      }

      .mini-button:hover,
      .action-button:hover {
        background: rgba(111, 197, 255, 0.18);
      }

      .mini-button.strong,
      .action-button {
        background: linear-gradient(90deg, rgba(71, 191, 255, 0.24), rgba(87, 226, 255, 0.16));
      }

      .action-button {
        width: 100%;
        padding: 0.82rem 0.96rem;
        margin-top: auto;
        font-size: 0.84rem;
        letter-spacing: 0.18em;
      }

      .action-button.confirm {
        border-color: rgba(255, 148, 106, 0.38);
        background: linear-gradient(90deg, rgba(255, 116, 59, 0.22), rgba(255, 169, 108, 0.14));
      }

      .action-button:disabled {
        opacity: 0.36;
        cursor: not-allowed;
      }

      .overlay-mask {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 8, 22, 0.66);
        backdrop-filter: blur(10px);
      }

      .overlay-card {
        width: min(580px, calc(100% - 2rem));
        max-height: calc(100% - 2rem);
        overflow: auto;
        padding: 1.2rem;
        border-radius: 24px;
        border: 1px solid rgba(132, 224, 255, 0.18);
        background: rgba(5, 15, 34, 0.94);
      }

      .mode-select-mask {
        z-index: 24;
      }

      .mode-select-card {
        width: min(720px, calc(100% - 2rem));
        padding: 1.4rem;
      }

      .mode-select-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
        margin-top: 1rem;
      }

      .mode-option {
        appearance: none;
        width: 100%;
        padding: 1rem 1.05rem;
        border-radius: 22px;
        border: 1px solid rgba(132, 224, 255, 0.18);
        background: rgba(8, 22, 44, 0.9);
        color: rgba(230, 247, 255, 0.92);
        text-align: left;
        cursor: pointer;
      }

      .mode-option.story {
        border-color: rgba(255, 222, 148, 0.28);
        box-shadow: 0 0 30px rgba(255, 235, 178, 0.08);
      }

      .mode-option.challenge {
        border-color: rgba(129, 220, 255, 0.22);
      }

      .mode-option-title {
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.06em;
      }

      .mode-option-copy {
        margin-top: 0.4rem;
        font-size: 0.78rem;
        line-height: 1.6;
        color: rgba(190, 228, 245, 0.72);
      }

      .overlay-actions {
        display: flex;
        gap: 0.72rem;
        margin-top: 1rem;
      }

      .space-reorg-backdrop {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }

      .space-reorg-overlay {
        position: absolute;
        inset: 0;
        z-index: 8;
        pointer-events: none;
        overflow: hidden;
      }

      .space-reorg-whitewash,
      .space-reorg-grid-field,
      .space-reorg-cell-field {
        position: absolute;
        inset: 0;
      }

      .space-reorg-whitewash {
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02) 38%, rgba(255, 255, 255, 0.08) 100%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02) 42%, rgba(255, 255, 255, 0.07) 100%);
        animation: space-reorg-flash 900ms ease both;
      }

      .space-reorg-grid-field {
        z-index: 1;
      }

      .space-reorg-grid-line {
        position: absolute;
        opacity: 0;
      }

      .space-reorg-grid-line.horizontal {
        transform: translateY(-50%) scaleX(0);
        transform-origin: left center;
        animation: space-reorg-line-in 680ms cubic-bezier(0.16, 0.84, 0.24, 1) forwards;
        animation-delay: calc(var(--order) * 34ms);
      }

      .space-reorg-grid-line.vertical {
        transform: translateX(-50%) scaleY(0);
        transform-origin: center top;
        animation: space-reorg-line-in-vertical 680ms cubic-bezier(0.16, 0.84, 0.24, 1) forwards;
        animation-delay: calc(var(--order) * 26ms);
      }

      .space-reorg-backdrop.closing .space-reorg-grid-line.horizontal {
        animation: space-reorg-line-out 560ms ease forwards;
        animation-delay: calc(var(--order) * 18ms);
      }

      .space-reorg-backdrop.closing .space-reorg-grid-line.vertical {
        animation: space-reorg-line-out-vertical 560ms ease forwards;
        animation-delay: calc(var(--order) * 18ms);
      }

      .space-reorg-grid-stroke {
        position: absolute;
        display: block;
        overflow: hidden;
        border-radius: 0;
      }

      .space-reorg-grid-stroke.horizontal {
        left: 0;
        top: calc(50% - 2px);
        width: 100%;
        height: 4px;
        background: linear-gradient(
          90deg,
          rgba(250, 252, 255, 0.96) 0%,
          rgba(232, 242, 255, 0.98) 52%,
          rgba(250, 252, 255, 0.96) 100%
        );
      }

      .space-reorg-grid-stroke.vertical {
        top: 0;
        left: calc(50% - 2px);
        width: 4px;
        height: 100%;
        background: linear-gradient(
          180deg,
          rgba(250, 252, 255, 0.96) 0%,
          rgba(232, 242, 255, 0.98) 52%,
          rgba(250, 252, 255, 0.96) 100%
        );
      }

      .space-reorg-cell-field {
        z-index: 0;
      }

      .space-reorg-cell {
        position: absolute;
        opacity: 0;
        mix-blend-mode: screen;
        animation: space-reorg-cell-in 880ms ease forwards, space-reorg-cell-shift var(--cell-duration, 4.8s) linear infinite alternate;
        animation-delay: 1.1s, var(--cell-delay, 0s);
      }

      .space-reorg-backdrop.closing .space-reorg-cell {
        animation: space-reorg-cell-out 960ms ease forwards;
        animation-delay: calc(var(--order) * 18ms);
      }

      .space-reorg-center {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 9;
        width: min(500px, calc(100% - 2rem));
        padding: 1rem 1.2rem;
        border-radius: 28px;
        border: 1px solid rgba(255, 219, 132, 0.48);
        background: rgba(253, 249, 238, 0.74);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.42),
          0 18px 54px rgba(68, 46, 16, 0.16);
        color: rgba(77, 53, 16, 0.92);
        text-align: center;
        pointer-events: auto;
      }

      .space-reorg-kicker {
        font-size: 0.76rem;
        letter-spacing: 0.24em;
        color: rgba(154, 117, 34, 0.76);
      }

      .space-reorg-copy {
        margin-top: 0.5rem;
        font-size: 0.88rem;
        line-height: 1.7;
      }

      .space-reorg-amounts {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.56rem;
        margin-top: 0.9rem;
      }

      .space-reorg-amounts.slider-mode {
        width: min(320px, 100%);
        margin: 0.9rem auto 0;
        display: grid;
        gap: 0.72rem;
      }

      .space-reorg-slider-readout {
        margin: 0 auto;
        min-width: 3.4rem;
        padding: 0.34rem 0.72rem;
        border-radius: 999px;
        border: 1px solid rgba(203, 165, 65, 0.34);
        background: rgba(255, 247, 225, 0.9);
        color: rgba(122, 83, 8, 0.96);
        font-size: 1rem;
        font-weight: 800;
        line-height: 1;
      }

      .space-reorg-slider {
        width: 100%;
        appearance: none;
        height: 26px;
        padding: 0 6px;
        border-radius: 999px;
        border: 1px solid rgba(203, 165, 65, 0.26);
        background:
          radial-gradient(circle at 12px 50%, rgba(228, 188, 84, 0.22) 0 2px, transparent 2.4px) 0 50% / 18px 100% repeat-x,
          linear-gradient(90deg, rgba(242, 228, 187, 0.68), rgba(255, 247, 224, 0.9));
        box-shadow:
          inset 0 0 0 1px rgba(201, 164, 72, 0.24),
          0 0 18px rgba(255, 232, 168, 0.12);
        cursor: ew-resize;
      }

      .space-reorg-slider::-webkit-slider-thumb {
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 2px solid rgba(255, 250, 240, 0.88);
        background: linear-gradient(180deg, rgba(255, 236, 174, 1), rgba(232, 182, 62, 0.96));
        box-shadow:
          0 0 0 1px rgba(166, 120, 16, 0.22),
          0 0 18px rgba(255, 223, 122, 0.28);
      }

      .space-reorg-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 2px solid rgba(255, 250, 240, 0.88);
        background: linear-gradient(180deg, rgba(255, 236, 174, 1), rgba(232, 182, 62, 0.96));
        box-shadow:
          0 0 0 1px rgba(166, 120, 16, 0.22),
          0 0 18px rgba(255, 223, 122, 0.28);
      }

      .space-reorg-slider-scale {
        display: flex;
        justify-content: space-between;
        font-size: 0.72rem;
        color: rgba(138, 109, 37, 0.72);
        letter-spacing: 0.08em;
      }

      .space-reorg-amount {
        appearance: none;
        min-width: 2.8rem;
        padding: 0.56rem 0.8rem;
        border-radius: 999px;
        border: 1px solid rgba(196, 151, 42, 0.32);
        background: rgba(255, 244, 208, 0.88);
        color: rgba(106, 73, 9, 0.94);
        cursor: pointer;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .space-reorg-amount.confirm {
        min-width: 4.8rem;
        justify-self: center;
      }

      .space-reorg-float {
        position: absolute;
        z-index: 11;
        font-size: 2.8rem;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-shadow: 0 0 24px currentColor;
      }

      .space-reorg-float.source {
        color: rgba(220, 68, 68, 0.94);
      }

      .space-reorg-float.target {
        color: rgba(221, 161, 44, 0.94);
      }

      .time-elapse-overlay {
        position: absolute;
        inset: 0;
        z-index: 14;
        pointer-events: none;
        overflow: hidden;
      }

      .time-elapse-defs {
        position: absolute;
        width: 0;
        height: 0;
      }

      .time-elapse-stage {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 220px;
        height: 220px;
        transform: translate(-50%, -190%);
        z-index: 1;
        transition: opacity 620ms ease, filter 620ms ease;
      }

      .time-elapse-ripples,
      .time-elapse-clock {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      }

      .time-elapse-distortions {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
      }

      .time-elapse-distortion {
        position: absolute;
        inset: 0;
        opacity: 0;
        clip-path: circle(0% at 50% 50%);
        animation: time-elapse-distortion-spread var(--distort-duration) ease-out var(--distort-delay) both;
      }

      .time-elapse-distortion-board {
        position: absolute;
        inset: 0;
        transform-origin: 50% 50%;
      }

      .time-elapse-clone-board {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: max-content minmax(84px, 1fr) max-content;
        gap: 0.65rem;
        padding: 0.25rem 0.15rem 0.1rem;
      }

      .time-elapse-clone-board .unit-cell,
      .time-elapse-clone-board .feed-line,
      .time-elapse-clone-board .incoming-buff-callout,
      .time-elapse-clone-board .power-mark,
      .time-elapse-clone-board .buff-chip,
      .time-elapse-clone-board .tag-chip {
        pointer-events: none;
      }

      .time-elapse-clone-board .unit-button,
      .time-elapse-clone-board .segment-button,
      .time-elapse-clone-board .cancel-chip {
        display: none;
      }

      .time-elapse-clone-row,
      .time-elapse-clone-middle {
        position: relative;
        z-index: 1;
      }

      .time-elapse-overlay .time-elapse-stage {
        animation: time-elapse-drop 2.05s cubic-bezier(0.15, 0.82, 0.18, 1) forwards;
      }

      .time-elapse-overlay.fade-out .time-elapse-stage {
        opacity: 0;
        filter: blur(6px);
      }

      .time-elapse-ripples {
        width: 0;
        height: 0;
        overflow: visible;
      }

      .time-elapse-ripple {
        position: absolute;
        left: 50%;
        top: 50%;
        width: clamp(900px, 138vmax, 2200px);
        height: clamp(900px, 138vmax, 2200px);
        margin-left: calc(clamp(900px, 138vmax, 2200px) / -2);
        margin-top: calc(clamp(900px, 138vmax, 2200px) / -2);
        border-radius: 50%;
        border: 4px solid rgba(255, 250, 236, 0.54);
        box-shadow:
          0 0 54px rgba(255, 246, 214, 0.22),
          inset 0 0 72px rgba(255, 255, 255, 0.06);
        opacity: 0;
        mix-blend-mode: screen;
        filter: blur(1px);
      }

      .time-elapse-overlay .time-elapse-ripple.r1 {
        animation: time-elapse-ripple var(--wave-duration) ease-out var(--wave-delay) infinite;
      }

      .time-elapse-overlay .time-elapse-ripple.r2 {
        animation: time-elapse-ripple var(--wave-duration) ease-out var(--wave-delay) infinite;
      }

      .time-elapse-overlay .time-elapse-ripple.r3 {
        animation: time-elapse-ripple var(--wave-duration) ease-out var(--wave-delay) infinite;
      }

      .time-elapse-overlay .time-elapse-ripple.r4 {
        animation: time-elapse-ripple var(--wave-duration) ease-out var(--wave-delay) infinite;
      }

      .time-elapse-overlay.fade-out .time-elapse-ripple {
        animation: none;
        opacity: 0;
        transition: opacity 260ms ease;
      }

      .time-elapse-overlay.fade-out .time-elapse-distortion {
        animation: none;
        opacity: 0;
        transition: opacity 260ms ease;
      }

      .time-elapse-clock {
        width: 192px;
        height: 192px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 34% 30%, rgba(255, 252, 244, 0.99), rgba(255, 238, 196, 0.94) 36%, rgba(184, 143, 60, 0.96) 100%);
        box-shadow:
          0 0 0 3px rgba(255, 251, 238, 0.74),
          0 0 60px rgba(255, 231, 165, 0.34);
      }

      .time-elapse-clock::before {
        content: "";
        position: absolute;
        inset: 12px;
        border-radius: 50%;
        border: 2px solid rgba(255, 250, 240, 0.68);
        box-shadow: inset 0 0 0 1px rgba(161, 118, 24, 0.14);
      }

      .time-elapse-hand {
        position: absolute;
        left: 50%;
        bottom: 50%;
        transform-origin: 50% 100%;
        transform: translateX(-50%) rotate(0deg);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(140, 102, 24, 0.94));
        box-shadow: 0 0 12px rgba(255, 236, 170, 0.24);
      }

      .time-elapse-hand.minute {
        width: 4px;
        height: 74px;
      }

      .time-elapse-hand.hour {
        width: 6px;
        height: 54px;
      }

      .time-elapse-overlay .time-elapse-hand.minute {
        animation: time-elapse-minute 2.45s cubic-bezier(0.32, 0.03, 0.16, 1) forwards;
      }

      .time-elapse-overlay .time-elapse-hand.hour {
        animation: time-elapse-hour 2.45s cubic-bezier(0.32, 0.03, 0.16, 1) forwards;
      }

      .time-elapse-center-dot {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 12px;
        height: 12px;
        margin-left: -6px;
        margin-top: -6px;
        border-radius: 50%;
        background: rgba(116, 82, 16, 0.96);
        box-shadow: 0 0 0 2px rgba(255, 251, 238, 0.88);
      }

      .time-elapse-turn {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 3;
        transform: translate(-50%, -50%) scale(0.72);
        opacity: 0;
        font-size: 3.4rem;
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0.06em;
        color: rgba(255, 248, 234, 0.98);
        text-shadow:
          0 0 24px rgba(255, 227, 148, 0.36),
          0 0 40px rgba(255, 255, 255, 0.22);
      }

      .time-elapse-turn.pop {
        animation: time-elapse-turn-pop 1.18s ease forwards;
      }

      .time-elapse-skip-badge {
        position: absolute;
        z-index: 4;
        transform: translate(-50%, calc(-100% - 14px));
        padding: 0.22rem 0.76rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 221, 132, 0.72);
        background: rgba(67, 45, 6, 0.94);
        color: rgba(255, 242, 188, 0.98);
        font-size: 0.7rem;
        font-weight: 900;
        letter-spacing: 0.03em;
        line-height: 1;
        white-space: nowrap;
        text-shadow: 0 0 12px rgba(255, 234, 170, 0.22);
        box-shadow:
          0 0 26px rgba(255, 214, 102, 0.28),
          0 0 42px rgba(255, 233, 169, 0.14);
        animation: time-skip-callout-pulse 1.2s ease-in-out infinite alternate;
      }

      @keyframes time-elapse-drop {
        0% {
          transform: translate(-50%, -190%);
        }
        74% {
          transform: translate(-50%, -40%);
        }
        100% {
          transform: translate(-50%, -50%);
        }
      }

      @keyframes time-elapse-ripple {
        0% {
          opacity: 0;
          transform: scale(0.03);
        }
        12% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          transform: scale(1);
        }
      }

      @keyframes time-elapse-distortion-spread {
        0% {
          opacity: 0;
          clip-path: circle(0% at 50% 50%);
        }
        8% {
          opacity: 0.72;
        }
        72% {
          opacity: 0.64;
        }
        100% {
          opacity: 0;
          clip-path: circle(140% at 50% 50%);
        }
      }

      @keyframes time-elapse-minute {
        0% {
          transform: translateX(-50%) rotate(0deg);
        }
        64% {
          transform: translateX(-50%) rotate(2260deg);
        }
        100% {
          transform: translateX(-50%) rotate(2880deg);
        }
      }

      @keyframes time-elapse-hour {
        0% {
          transform: translateX(-50%) rotate(0deg);
        }
        100% {
          transform: translateX(-50%) rotate(360deg);
        }
      }


      @keyframes time-elapse-turn-pop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.72);
        }
        20% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(265px, -320px) scale(0.34);
        }
      }

      @keyframes time-elapse-distort-drift-a {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        18% { transform: translate3d(6px, -3px, 0) scale(1.01, 0.992); }
        42% { transform: translate3d(-7px, 4px, 0) scale(0.994, 1.008); }
        72% { transform: translate3d(4px, -2px, 0) scale(1.005, 0.997); }
      }

      @keyframes time-elapse-distort-drift-b {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        16% { transform: translate3d(-8px, 5px, 0) scale(0.992, 1.012); }
        46% { transform: translate3d(7px, -4px, 0) scale(1.01, 0.993); }
        70% { transform: translate3d(-4px, 3px, 0) scale(0.997, 1.006); }
      }

      @keyframes time-elapse-distort-drift-c {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        20% { transform: translate3d(5px, 6px, 0) scale(1.008, 0.994); }
        48% { transform: translate3d(-6px, -4px, 0) scale(0.993, 1.01); }
        76% { transform: translate3d(3px, 2px, 0) scale(1.004, 0.997); }
      }

      @keyframes time-skip-highlight {
        from {
          box-shadow:
            0 0 0 1px rgba(255, 236, 190, 0.24),
            0 0 18px rgba(255, 212, 102, 0.16),
            0 0 28px rgba(118, 180, 255, 0.08);
        }
        to {
          box-shadow:
            0 0 0 1px rgba(255, 236, 190, 0.42),
            0 0 32px rgba(255, 212, 102, 0.32),
            0 0 54px rgba(118, 180, 255, 0.14);
        }
      }

      @keyframes time-skip-callout-pulse {
        from {
          opacity: 0.72;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(-2px);
        }
      }

      .time-elapse-distortion-board.time-elapse-distort-drift-a {
        animation: time-elapse-distort-drift-a 2.42s ease-out 0s both;
      }

      .time-elapse-distortion-board.time-elapse-distort-drift-b {
        animation: time-elapse-distort-drift-b 2.94s ease-out 0.48s both;
      }

      .time-elapse-distortion-board.time-elapse-distort-drift-c {
        animation: time-elapse-distort-drift-c 2.72s ease-out 1.02s both;
      }

      .log-list,
      .rules-list {
        display: flex;
        flex-direction: column;
        gap: 0.52rem;
      }

      .log-line {
        display: grid;
        grid-template-columns: 44px 58px minmax(0, 1fr);
        gap: 0.6rem;
        font-size: 0.8rem;
        color: rgba(223, 244, 255, 0.84);
      }

      .rule-line {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        gap: 0.72rem;
        font-size: 0.8rem;
        color: rgba(223, 244, 255, 0.84);
        padding-bottom: 0.06rem;
      }

      .log-turn,
      .rule-index {
        color: rgba(140, 218, 255, 0.62);
      }

      .log-type {
        text-transform: uppercase;
        color: rgba(169, 228, 255, 0.82);
      }

      .log-type.enemy {
        color: rgba(255, 169, 132, 0.88);
      }

      .log-type.destroy {
        color: rgba(255, 127, 127, 0.88);
      }

      .fade-in {
        animation: fade-up 260ms ease both;
      }

      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes space-reorg-flash {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes space-reorg-line-in {
        from {
          opacity: 0;
          transform: translateY(-50%) scaleX(0);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) scaleX(1);
        }
      }

      @keyframes space-reorg-line-in-vertical {
        from {
          opacity: 0;
          transform: translateX(-50%) scaleY(0);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) scaleY(1);
        }
      }

      @keyframes space-reorg-line-out {
        from {
          opacity: 1;
          transform: translateY(-50%) scaleX(1);
        }
        to {
          opacity: 0;
          transform: translateY(-50%) translateX(8%) scaleX(0.2);
        }
      }

      @keyframes space-reorg-line-out-vertical {
        from {
          opacity: 1;
          transform: translateX(-50%) scaleY(1);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(8%) scaleY(0.2);
        }
      }

      @keyframes space-reorg-cell-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 0.5;
        }
      }

      @keyframes space-reorg-cell-out {
        from {
          opacity: 0.68;
        }
        to {
          opacity: 0;
        }
      }

      @keyframes space-reorg-cell-shift {
        0% {
          background: rgba(255, 223, 92, 0.34);
        }
        34% {
          background: rgba(98, 174, 255, 0.24);
        }
        67% {
          background: rgba(86, 164, 255, 0.36);
        }
        100% {
          background: rgba(255, 226, 88, 0.24);
        }
      }

      @keyframes motion-link-pulse {
        from {
          background-position: 180% 50%;
        }
        to {
          background-position: 0% 50%;
        }
      }

      @keyframes motion-link-fill {
        from {
          clip-path: inset(0 100% 0 0);
        }
        to {
          clip-path: inset(0 0 0 0);
        }
      }

      @keyframes motion-link-release {
        from {
          clip-path: inset(0 0 0 0);
          opacity: 1;
        }
        to {
          clip-path: inset(0 0 0 100%);
          opacity: 0;
        }
      }

      @keyframes space-reorg-float {
        0% {
          opacity: 0;
          transform: translateY(18px) scale(0.9);
        }
        14% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        78% {
          opacity: 1;
          transform: translateY(-6px) scale(1.03);
        }
        100% {
          opacity: 0;
          transform: translateY(-18px) scale(0.96);
        }
      }

      @media (max-width: 1120px) {
        .battle-layout {
          grid-template-columns: 1fr;
          height: 100%;
        }

        .side-panel {
          height: auto;
          display: flex;
          flex-direction: column;
        }

        .guide-card {
          position: static;
          width: auto;
          transform: none;
          margin-top: 0.4rem;
        }
      }

      @media (max-width: 760px) {
        .battle-shell {
          height: auto;
          padding-left: 0.6rem;
          padding-right: 0.6rem;
        }

        .stage-board {
          min-height: 420px;
          height: auto;
        }

        .unit-cell {
          width: 92px;
          height: 126px;
          flex-basis: 92px;
        }

        .row {
          gap: 0.56rem;
        }

        .battle-toolbar {
          right: 0.6rem;
        }
      }
    `}</style>
  );
}
