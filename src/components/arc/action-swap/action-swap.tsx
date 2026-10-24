"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionStyle, type TargetAndTransition, type Transition, type Variants } from "motion/react";
import { CircleAlert } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./action-swap.module.css";

export type ActionSwapTone = "neutral" | "accent" | "success" | "warning" | "quiet";

export interface ActionSwapState {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: ActionSwapTone;
  /** Shown while `onAction` runs on the way into this state, such as "Sending" before "Sent". Without it the pill folds into a round spinner. */
  pendingLabel?: string;
  /** Milliseconds to hold this state before moving on by itself, for brief confirmations such as "Sent". */
  holdFor?: number;
}

export interface ActionSwapProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onChange" | "onClick" | "value" | "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart"> {
  states: ActionSwapState[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, state: ActionSwapState) => void;
  /** Runs on press before the control moves on. Return a promise to show the working phase; a rejection shows `failureLabel`, then returns to the current state. */
  onAction?: (next: ActionSwapState, current: ActionSwapState) => void | PromiseLike<unknown>;
  failureLabel?: string;
  size?: "sm" | "md" | "lg";
}

type Phase = { kind: "idle" } | { kind: "working"; target: ActionSwapState } | { kind: "failed" };
const IDLE: Phase = { kind: "idle" };
const FAILURE_HOLD = 1800;
/** A fast response still shows the working shape long enough to read as a step, never as a flash. */
const MIN_WORKING = 450;
const ICON = 16;

const pressVariants: Variants = {
  pressed: (button: RefObject<HTMLButtonElement | null>) => ({ scale: (button.current?.offsetWidth ?? 0) > 220 ? .985 : .97, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }),
};
const morph = motionTokens.spring.morph;
const instant = { duration: motionTokens.duration.instant } as const;
const soft = `blur(${motionTokens.blur.soft}px)`;
const tween = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } as const;
const leave = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } as const;
const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 };
const fadeOut: TargetAndTransition = { opacity: 0, transition: instant };
/** Letters rise about .3em out of a soft blur; the outgoing ones lift away a little faster. */
const glyphIn: TargetAndTransition = { opacity: 0, y: 4, filter: soft };
const glyphOut: TargetAndTransition = { opacity: 0, y: -3, filter: soft, transition: leave };
/** Icons trade places through a blur: the old one shrinks away while the new one grows out of it on the spring. */
const iconIn: TargetAndTransition = { opacity: 0, scale: .5, filter: soft };
const iconOut: TargetAndTransition = { ...iconIn, transition: leave };
const iconEnter: Transition = { scale: motionTokens.spring.snappy, opacity: tween, filter: tween };
/** Success lands with a little more give: the icon settles just past full size once while its stroke wipes in from the leading edge. */
const successIn: TargetAndTransition = { ...iconIn, clipPath: "inset(0% 100% 0% 0%)" };
const successRest: TargetAndTransition = { ...rest, clipPath: "inset(0% 0% 0% 0%)" };
const successEnter: Transition = { scale: { type: "spring", visualDuration: .45, bounce: 0 }, opacity: tween, filter: tween, clipPath: { duration: .36, ease: [...motionTokens.ease.standard], delay: .02 } };

/** Springs the wrapper to the border-box width of the incoming label when the text changes, down to zero when the pill folds.
 *  Other resizes (a late web font, a parent reflow) jump straight to the new width, so nothing wobbles on first paint. */
function useMorphWidth(content: RefObject<HTMLElement | null>, key: string, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(key), armedUntil = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    armedUntil.current = performance.now() + 700;
  }, [key]);
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (!measured || reduced || performance.now() > armedUntil.current) { measured = true; width.jump(next); return; }
      animate(width, next, morph);
    });
    observer.observe(node, { box: "border-box" });
    return () => observer.disconnect();
  }, [content, reduced, width]);
  // The spring may dip below zero as it settles on a fold; a negative width would be dropped by the browser and pop the label back.
  return useTransform(width, value => typeof value === "number" ? Math.max(0, value) : value);
}

type Glyph = { id: string; char: string; order: number; lead: number };
const toGlyphs = (chars: string[], seq: number, lead = 0): Glyph[] => chars.map((char, order) => ({ id: `${seq}:${order}`, char, order, lead }));

/** Shared leading and trailing characters keep their identity, so only the changed run of text is replaced.
 *  Letters that grow out of a folded pill wait a beat, so they arrive as the shape opens instead of crowding its edge. */
function useGlyphs(text: string) {
  const [state, setState] = useState(() => ({ text, seq: 0, glyphs: toGlyphs([...text], 0) }));
  if (state.text === text) return state.glyphs;
  const prev = [...state.text], next = [...text];
  let start = 0, end = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  while (end < prev.length - start && end < next.length - start && prev[prev.length - 1 - end] === next[next.length - 1 - end]) end++;
  if (start < 2) start = 0;
  if (end < 2) end = 0;
  const seq = state.seq + 1;
  const glyphs = [...state.glyphs.slice(0, start), ...toGlyphs(next.slice(start, next.length - end), seq, prev.length ? 0 : .1), ...state.glyphs.slice(state.glyphs.length - end)];
  setState({ text, seq, glyphs });
  return glyphs;
}

/** Morphs one label into the next: kept letters stay, new ones rise in from a soft blur, and the width follows on a spring.
 *  The gap to the icon lives inside the measured row, so it closes with the label when the pill folds. */
function MorphText({ text, gap, reduced }: { text: string; gap: boolean; reduced: boolean }) {
  const glyphs = useGlyphs(text);
  const rowRef = useRef<HTMLSpanElement>(null);
  const layoutKey = `${gap ? 1 : 0}${text}`;
  const width = useMorphWidth(rowRef, layoutKey, reduced);
  return <motion.span className={styles.morph} style={{ width }} aria-hidden="true">
    <span ref={rowRef} className={styles.glyphs} data-gap={gap || undefined}>
      <AnimatePresence mode="popLayout" initial={false}>
        {glyphs.map(glyph => <motion.span key={glyph.id} className={styles.glyph} layout={reduced ? false : "position"} layoutDependency={layoutKey} initial={reduced ? fadeIn : glyphIn} animate={rest} exit={reduced ? fadeOut : glyphOut} transition={reduced ? instant : { ...tween, delay: glyph.lead + Math.min(glyph.order * motionTokens.stagger.char, .12), layout: morph }}>{glyph.char}</motion.span>)}
      </AnimatePresence>
    </span>
  </motion.span>;
}

/** A compact action that morphs through a small set of related states: idle, working, done, and back.
 *  Width, padding, tone, icon, and letters move together on one spring, and every change can be interrupted mid-flight. */
export function ActionSwap({ states, value, defaultValue, onValueChange, onAction, failureLabel = "Try again", size = "md", className, disabled, style, ...props }: ActionSwapProps) {
  const firstId = states[0]?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstId);
  const [phase, setPhase] = useState<Phase>(IDLE);
  const [spoken, setSpoken] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const run = useRef(0);
  const reduced = useReducedMotion() ?? false;
  const activeValue = value ?? internalValue;
  const activeIndex = Math.max(0, states.findIndex(state => state.id === activeValue));
  const activeState = states[activeIndex] ?? states[0];
  const nextState = states[(activeIndex + 1) % states.length] ?? activeState;
  const inactive = disabled || states.length < 2;
  const working = phase.kind === "working";
  const folded = phase.kind === "working" && !phase.target.pendingLabel;

  function commit(next: ActionSwapState) {
    setPhase(IDLE);
    if (value === undefined) setInternalValue(next.id);
    setSpoken(next.label);
    onValueChange?.(next.id, next);
  }
  function fail() {
    setPhase({ kind: "failed" });
    setSpoken(failureLabel);
  }
  function advance() {
    if (!activeState || !nextState || inactive || working) return;
    const next = nextState, id = ++run.current;
    let result: void | PromiseLike<unknown>;
    try { result = onAction?.(next, activeState); } catch { fail(); return; }
    if (!result || typeof result.then !== "function") { commit(next); return; }
    setPhase({ kind: "working", target: next });
    setSpoken(next.pendingLabel ?? "Working");
    const started = performance.now();
    const settle = (done: () => void) => window.setTimeout(() => { if (run.current === id) done(); }, Math.max(0, MIN_WORKING - (performance.now() - started)));
    result.then(() => settle(() => commit(next)), () => settle(fail));
  }

  // Timers read the latest props through a ref, so a parent re-render never restarts a hold.
  const latest = useRef({ commit, nextState });
  useLayoutEffect(() => { latest.current = { commit, nextState }; });
  useEffect(() => () => { run.current += 1; }, []);
  const holdFor = phase.kind === "idle" ? activeState?.holdFor : undefined;
  useEffect(() => {
    if (!holdFor) return;
    const timer = window.setTimeout(() => { const { commit: settle, nextState: next } = latest.current; if (next) settle(next); }, holdFor);
    return () => window.clearTimeout(timer);
  }, [holdFor, activeState?.id]);
  useEffect(() => {
    if (phase.kind !== "failed") return;
    const timer = window.setTimeout(() => setPhase(IDLE), FAILURE_HOLD);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // One value drives the fold: the padding eases from the pill's to the circle's on the same spring as the label width.
  const fold = useMotionValue(folded ? 1 : 0);
  useEffect(() => { animate(fold, folded ? 1 : 0, reduced ? { duration: 0 } : morph); }, [fold, folded, reduced]);

  if (!activeState) return null;

  const view = phase.kind === "working" ? { key: "working", label: phase.target.pendingLabel ?? "", icon: <span className={styles.spinner} />, tone: activeState.tone ?? "neutral" }
    : phase.kind === "failed" ? { key: "failed", label: failureLabel, icon: <CircleAlert size={ICON} strokeWidth={1.75} />, tone: "danger" }
    : { key: `state:${activeState.id}`, label: activeState.label, icon: activeState.icon, tone: activeState.tone ?? "neutral" };
  const draw = view.tone === "success" && !reduced;

  // tabIndex is pinned so the server and a reduced-motion client (which drops whileTap, and with it Motion's implicit tabindex) render alike.
  return <>
    <motion.button {...props} ref={buttonRef} type={props.type ?? "button"} tabIndex={props.tabIndex ?? 0} className={[styles.button, styles[size], styles[view.tone], className].filter(Boolean).join(" ")} style={{ ...style, "--fold": fold } as MotionStyle} disabled={inactive} aria-disabled={working || undefined} aria-busy={working || undefined} aria-label={view.label || activeState.label} data-phase={phase.kind} onClick={advance} custom={buttonRef} variants={pressVariants} whileTap={reduced || inactive || working ? undefined : "pressed"} transition={motionTokens.spring.snappy}>
      <motion.span className={styles.icon} aria-hidden="true" initial={false} animate={{ width: view.icon ? ICON : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
        <AnimatePresence initial={false}>
          {view.icon ? <motion.span key={view.key} className={styles.iconPhase} data-tone={view.tone} initial={reduced ? fadeIn : draw ? successIn : iconIn} animate={draw ? successRest : rest} exit={reduced ? fadeOut : iconOut} transition={reduced ? instant : draw ? successEnter : iconEnter}>{view.icon}</motion.span> : null}
        </AnimatePresence>
      </motion.span>
      <MorphText text={view.label} gap={Boolean(view.icon) && view.label.length > 0} reduced={reduced} />
    </motion.button>
    <span className={styles.srOnly} role="status" aria-live="polite">{spoken}</span>
  </>;
}

export default ActionSwap;
