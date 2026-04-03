import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
const {
  getBuffDescriptions: modelGetBuffDescriptions,
  getBuffShortLabels: modelGetBuffShortLabels,
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
} = require("./engine/view-model");
const { buildAssetUrl, resolveMusicTrack } = require("./data/music");

const TAG_SYMBOLS = {
  "◆": "◆",
  "▲": "▲",
  "▼": "▼",
  "●": "●",
  "※": "※",
};

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
  const pageIndex = gameState.story.index;
  const page = gameState.story.pages[pageIndex];
  const [revealedCount, setRevealedCount] = useState(1);

  useEffect(() => {
    setRevealedCount(1);
  }, [pageIndex]);

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
        <div className="story-page">
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

function Overlay({ title, children, onClose }) {
  return (
    <div className="overlay-mask" onClick={onClose}>
      <div className="overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function LogOverlay({ battle, onClose }) {
  return (
    <Overlay title="行动记录" onClose={onClose}>
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
    <Overlay title="RULES" onClose={onClose}>
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
      className={`battle-arrow ${arrow.hostile ? "hostile" : "friendly"} ${arrow.dashed ? "dashed" : ""}`}
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
        markerEnd="url(#library-run-arrow-head)"
      />
    </svg>
  );
}

function CellMeta({ unit, gameState }) {
  const power = modelGetPowerDisplay(unit, gameState);
  const buffLabels = modelGetBuffShortLabels(unit);
  const virusState = modelGetVirusState(unit);
  const hasLockedTarget = modelHasLockedTarget(unit);
  const showLockedTarget = hasLockedTarget && (modelIsPlayerCommandable(unit) || unit.abilityCode !== unit.code);

  return (
    <div className="cell-meta">
      {showLockedTarget ? <div className="unit-status-chip locked-target">锁定目标</div> : null}
      {virusState ? (
        <div className={`unit-status-chip virus ${virusState}`}>
          {virusState === "active" ? "病毒生效" : "病毒潜伏"}
        </div>
      ) : null}
      <div className="unit-power-line">
        <span className="power-label">POWER</span>
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
    !unit.alive ? "dead" : "",
    isDisguise ? "disguise-cell" : "",
  ].filter(Boolean).join(" ");

  if (!isDisguise) {
    return (
      <div className={rootClassName} ref={registerRef}>
        <div className="unit-shell">
          <button type="button" className="unit-button" onClick={onClick} />
          <CellMeta unit={unit} gameState={gameState} />
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
    <div className={rootClassName} ref={registerRef}>
      <div className="unit-shell disguise-shell">
        <button
          type="button"
          className={[
            "segment-button",
            "top",
            targetReady ? "target-ready" : "",
            targetSelected ? "target-selected" : "",
          ].filter(Boolean).join(" ")}
          onClick={onTopClick}
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
        />
        <CellMeta unit={unit} gameState={gameState} />
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
  onSetManifest,
  manifestValue,
  setManifestValue,
  guideStep,
}) {
  const power = modelGetPowerDisplay(selectedUnit, gameState);
  const buffDescriptions = modelGetBuffDescriptions(selectedUnit);
  const abilityContextEntries = modelGetAbilityContextEntries(selectedUnit, battle);

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

            <div className={`panel-copy ${hasHighlight(guideStep, "area", "panel-description") ? "guide-glow-inline" : ""}`}>
              {selectedUnit.description}
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

            {selectedUnit.id === "p-robot" ? (
              <>
                <div className="panel-subtitle">显现</div>
                <div className="manifest-grid">
                  {[1, 3, 5, 7, 9].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`mini-button ${manifestValue === value ? "strong" : ""}`}
                      onClick={() => {
                        const nextValue = manifestValue === value ? null : value;
                        setManifestValue(nextValue);
                        onSetManifest(nextValue);
                      }}
                    >
                      {value}
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

  const [selectedAttackerId, setSelectedAttackerId] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [inspectId, setInspectId] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [manifestValue, setManifestValue] = useState(null);
  const [arrow, setArrow] = useState(null);

  useHideMusicPlayer();
  useBattleViewport(rootRef, gameState?.phase !== "STORY");
  const music = useStageMusic(gameState);
  const isStoryPhase = gameState?.phase === "STORY";

  const battle = gameState?.battle || null;
  const enemyConfirm = battle?.pendingEnemyAction || null;
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
  const forcedTargetId = selectedAttacker ? modelGetForcedTargetId(battle, selectedAttacker) : null;
  const inspectedUnit = allUnits.find((unit) => unit.id === inspectId)
    || selectedAttacker
    || playerUnits.find((unit) => unit.alive)
    || enemyUnits.find((unit) => unit.alive)
    || null;

  const centerFeed = useMemo(() => modelBuildCenterFeed(battle?.actionLog || []), [battle?.actionLog]);

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
    setManifestValue(battle?.pendingTurnEffects?.overloadPower ?? null);
  }, [battle?.pendingTurnEffects?.overloadPower]);

  useEffect(() => {
    const highlightedId = findHighlightedUnit(guideStep);
    if (highlightedId) {
      setInspectId(highlightedId);
    }
  }, [guideStep]);

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

  const canAttack = !!(
    selectedAttacker
    && selectedTarget
    && selectedAttacker.alive
    && selectedTarget.alive
    && battle?.status === "PLAYER_TURN"
    && !enemyConfirm
    && isTargetCandidate(selectedTarget, selectedAttacker)
  );

  const confirmControllerSide = enemyConfirm?.controllerSide || null;
  const confirmAttackerId = enemyConfirm?.attackerId || null;
  const confirmDefenderId = enemyConfirm?.defenderId || null;

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

  const registerNode = (id) => (node) => {
    if (node) {
      nodeRefs.current[id] = node;
    }
  };

  const selectAttacker = (unit) => {
    setInspectId(unit.id);
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
  };

  const selectTarget = (unit) => {
    setInspectId(unit.id);
    if (selectedAttacker && modelGetForcedTargetId(battle, selectedAttacker)) {
      return;
    }
    if (!isTargetCandidate(unit)) {
      return;
    }
    setSelectedTargetId(unit.id);
  };

  const selectEnemyRowUnit = (unit) => {
    setInspectId(unit.id);
    if (isAttackerCandidate(unit) && (!selectedAttacker || selectedAttacker.id !== unit.id)) {
      setSelectedAttackerId(unit.id);
      if (selectedTargetId === unit.id) {
        setSelectedTargetId(null);
      }
      return;
    }
    if (selectedAttacker && modelGetForcedTargetId(battle, selectedAttacker)) {
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

  return (
    <div className="library-run-root" ref={rootRef}>
      <audio ref={music.audioRef} hidden />
      <div className="battle-toolbar">
        {!isStoryPhase ? (
          <>
            <div className="mini-status">Turn {battle?.turn || 1}</div>
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
      ) : (
        <div className="battle-shell">
          <div className="battle-layout">
            <section className="stage-board" ref={stageRef}>
              <ArrowLayer arrow={arrow} />
              <div className={`row enemy-row ${hasHighlight(guideStep, "area", "enemy-row") ? "guide-glow" : ""}`}>
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
                    registerRef={registerNode(unit.id)}
                  />
                ))}
              </div>

              <div className={`stage-middle ${hasHighlight(guideStep, "area", "center-feed") ? "guide-glow" : ""}`}>
                <div className="center-feed">
                  {centerFeed.map((item) => (
                    <div key={item.key} className={`feed-line ${item.type}`}>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`row player-row ${hasHighlight(guideStep, "area", "player-row") ? "guide-glow" : ""}`}>
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
              onSetManifest={(value) => onAction("set-overload", { power: value })}
              manifestValue={manifestValue}
              setManifestValue={setManifestValue}
              guideStep={guideStep}
            />
          </div>
        </div>
      )}

      {!isStoryPhase && showLog ? <LogOverlay battle={battle} onClose={() => setShowLog(false)} /> : null}
      {!isStoryPhase && showRules ? <RulesOverlay rules={gameState.rulebook} onClose={() => setShowRules(false)} /> : null}
      {!isStoryPhase && gameState.pendingDefeat ? (
        <FailureOverlay
          reason={gameState.pendingDefeat.reason}
          onUndo={() => onAction("undo", {})}
          onGiveUp={() => onAction("give-up", {})}
        />
      ) : null}
      {!isStoryPhase && gameState.finalResults ? <ResultOverlay finalResults={gameState.finalResults} /> : null}
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
        background:
          radial-gradient(circle at 18% 16%, rgba(56, 167, 255, 0.24), transparent 28%),
          radial-gradient(circle at 78% 84%, rgba(255, 125, 66, 0.16), transparent 24%),
          linear-gradient(180deg, rgba(4, 16, 38, 0.96), rgba(3, 10, 25, 0.98));
      }

      body.library-run-hide-player .fixed.bottom-4.left-4.z-50 {
        display: none !important;
      }

      .story-shell {
        position: relative;
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
        min-height: 0;
        height: 100%;
        display: grid;
        grid-template-rows: max-content minmax(84px, 1fr) max-content;
        gap: 0.65rem;
        padding: 0.25rem 0.15rem 0.1rem;
      }

      .row {
        position: relative;
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

      .unit-cell:hover {
        transform: translateY(-3px);
      }

      .unit-cell.dead {
        opacity: 0.24;
        pointer-events: none;
      }

      .unit-shell {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 20px;
        border: 1px solid rgba(116, 161, 197, 0.16);
        background: rgba(61, 82, 102, 0.16);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        overflow: hidden;
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

      .segment-button.bottom {
        bottom: 0;
        background: linear-gradient(180deg, rgba(147, 220, 255, 0.12), rgba(64, 153, 255, 0.18));
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

      .unit-status-chip {
        width: fit-content;
        max-width: 100%;
        margin: 0 auto 0.14rem;
        padding: 0.08rem 0.34rem;
        border-radius: 999px;
        border: 1px solid rgba(128, 221, 255, 0.2);
        background: rgba(8, 23, 45, 0.78);
        color: rgba(229, 247, 255, 0.9);
        font-size: 0.5rem;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }

      .unit-status-chip.locked-target {
        border-color: rgba(255, 196, 143, 0.24);
        background: rgba(85, 39, 16, 0.76);
        color: rgba(255, 224, 188, 0.92);
      }

      .unit-status-chip.virus.latent {
        border-color: rgba(173, 134, 255, 0.24);
        background: rgba(42, 28, 76, 0.76);
        color: rgba(221, 205, 255, 0.92);
      }

      .unit-status-chip.virus.active {
        border-color: rgba(255, 103, 141, 0.28);
        background: rgba(101, 19, 42, 0.82);
        color: rgba(255, 211, 224, 0.96);
        box-shadow: 0 0 12px rgba(255, 86, 130, 0.2);
      }

      .unit-power-line {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 0.2rem;
        position: relative;
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
      .script-lines::-webkit-scrollbar {
        width: 8px;
      }

      .detail-card::-webkit-scrollbar-track,
      .script-lines::-webkit-scrollbar-track {
        border-radius: 999px;
        background: rgba(6, 20, 42, 0.18);
        box-shadow: inset 0 0 0 1px rgba(134, 220, 255, 0.08);
      }

      .detail-card::-webkit-scrollbar-thumb,
      .script-lines::-webkit-scrollbar-thumb {
        border-radius: 999px;
        border: 1px solid rgba(5, 16, 36, 0.68);
        background-clip: padding-box;
        transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }

      .detail-card::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(132, 226, 255, 0.92), rgba(58, 146, 255, 0.74));
        box-shadow: 0 0 10px rgba(66, 181, 255, 0.2);
      }

      .script-lines::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(255, 188, 142, 0.94), rgba(255, 124, 84, 0.72));
        box-shadow: 0 0 10px rgba(255, 142, 101, 0.18);
      }

      .detail-card:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(155, 235, 255, 0.96), rgba(76, 171, 255, 0.82));
      }

      .script-lines:hover::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(255, 203, 165, 0.96), rgba(255, 145, 96, 0.8));
      }

      .detail-card::-webkit-scrollbar-corner,
      .script-lines::-webkit-scrollbar-corner {
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

      .manifest-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 0.44rem;
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

      .overlay-actions {
        display: flex;
        gap: 0.72rem;
        margin-top: 1rem;
      }

      .log-list,
      .rules-list {
        display: flex;
        flex-direction: column;
        gap: 0.52rem;
        margin-top: 0.8rem;
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
