import { useEffect, useRef, useState } from 'react';
import type { LadderStructure } from '../../../shared/types/api';
import { Screen, Button, TopBar } from '../../../shared/ui';

/**
 * 사다리타기(네이버 스타일) — 한 화면에서 편집 → 시작 → 공개까지.
 *
 *  편집(ladder=null): 호스트가 칸마다 상단(이름)·하단(당첨항목)을 적고, 옵션 −/+ 로 칸을 2~10개
 *    조절한 뒤 '사다리 시작' → onBuild. 참가자는 "준비 중" 대기.
 *  진행(ladder≠null): 서버가 만든 가로줄을 그린다. 호스트가 위 시작칸을 누르면(onReveal) 그 칸이
 *    사다리를 따라 내려오는 애니메이션이 호스트·참가자 모두에게 재생된다. '결과 보기'(onResult)로 한 번에.
 *
 * 계약(백엔드 소유): ladder:build/built · ladder:reveal/revealed · ladder:result.
 * 구조·라벨·공개목록은 store(=서버 이벤트) 값을 그대로 받으므로 전원이 같은 사다리를 본다.
 */

const MIN = 2;
const MAX = 12;
const CANVAS_H = 300; // SVG 세로줄 높이(뷰박스 단위)
const COL = 100; // 칸당 가로 폭(뷰박스 단위) — colX(c) = c*COL + COL/2

/** 시작칸 색상(공개 순서 무관, 칸 index 로 고정) — 파스텔 팔레트(가는 선이라 살짝 진하게 해 가독 유지) */
const COLORS = [
  '#ef6b93', '#5fa8e0', '#5cbf7e', '#f0a94a', '#c079e0',
  '#ec6aa0', '#3fbdb0', '#d67ac0', '#7d88e8', '#e0a838',
];

const colX = (c: number) => c * COL + COL / 2;
const hasRung = (l: LadderStructure, row: number, col: number) =>
  l.rungs.some((g) => g.row === row && g.col === col);
const rungY = (l: LadderStructure, row: number) =>
  ((row + 1) / (l.rows + 1)) * CANVAS_H;

/** 시작칸 start 에서 사다리를 따라 내려오는 경로 좌표들(꺾은선). 끝점은 mapping[start] 칸. */
function tracePath(l: LadderStructure, start: number): Array<{ x: number; y: number }> {
  const pts = [{ x: colX(start), y: 0 }];
  let pos = start;
  for (let row = 0; row < l.rows; row++) {
    if (hasRung(l, row, pos)) {
      pts.push({ x: colX(pos), y: rungY(l, row) });
      pos += 1;
      pts.push({ x: colX(pos), y: rungY(l, row) });
    } else if (hasRung(l, row, pos - 1)) {
      pts.push({ x: colX(pos), y: rungY(l, row) });
      pos -= 1;
      pts.push({ x: colX(pos), y: rungY(l, row) });
    }
  }
  pts.push({ x: colX(pos), y: CANVAS_H });
  return pts;
}

const toPathD = (pts: Array<{ x: number; y: number }>) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

export function Ladder({
  roomId,
  isHost,
  ladder,
  topLabels,
  bottomLabels,
  revealed,
  draftTopLabels,
  draftBottomLabels,
  resultShown,
  onBuild,
  onReveal,
  onResult,
  onDraftChange,
  onLeave,
}: {
  roomId: string;
  isHost: boolean;
  ladder: LadderStructure | null;
  topLabels: string[];
  bottomLabels: string[];
  revealed: number[];
  /** 참가자용 — 호스트가 아직 시작 안 한(build 전) 동안의 실시간 미리보기 라벨(ladder:draft). */
  draftTopLabels?: string[];
  draftBottomLabels?: string[];
  /** '결과 보기'를 눌러 결과 모달이 뜬 상태. 이때는 사다리 내려오는 애니메이션 없이 정지된 판을 보여준다. */
  resultShown?: boolean;
  onBuild: (topLabels: string[], bottomLabels: string[]) => void;
  onReveal: (topIndex: number) => void;
  onResult: () => void;
  /** 호스트용 — 편집 중 목록이 바뀔 때마다 호출, 참가자에게 실시간 전송용(ladder:draft). */
  onDraftChange?: (topLabels: string[], bottomLabels: string[]) => void;
  onLeave: () => void;
}) {
  // ── 편집 상태(호스트, build 전) — 로컬. 서버로는 '사다리 시작' 때만 확정되고, 편집 중엔
  //    ladder:draft(relay)로 참가자에게 실시간으로만 전달된다(저장 안 됨). ──
  const [tops, setTops] = useState<string[]>(['', '', '', '']);
  const [bottoms, setBottoms] = useState<string[]>(['', '', '', '']);

  const resize = (arr: string[], n: number) =>
    arr.length === n
      ? arr
      : arr.length < n
        ? [...arr, ...Array<string>(n - arr.length).fill('')]
        : arr.slice(0, n);

  // 편집이 바뀔 때마다(호스트) 참가자에게 실시간 미리보기를 보낸다.
  const emitDraft = (nt: string[], nb: string[]) => {
    if (isHost) onDraftChange?.(nt, nb);
  };
  const setCount = (n: number) => {
    const next = Math.max(MIN, Math.min(MAX, n));
    const nt = resize(tops, next);
    const nb = resize(bottoms, next);
    setTops(nt);
    setBottoms(nb);
    emitDraft(nt, nb);
  };
  const setTop = (i: number, val: string) => {
    const nt = tops.map((x, j) => (j === i ? val : x));
    setTops(nt);
    emitDraft(nt, bottoms);
  };
  const setBottom = (i: number, val: string) => {
    const nb = bottoms.map((x, j) => (j === i ? val : x));
    setBottoms(nb);
    emitDraft(tops, nb);
  };

  // 최초 편집 진입 시 한 번 — 참가자에게 시작 상태(칸 수)를 알려 빈 보드를 바로 보여준다.
  const didInitDraft = useRef(false);
  useEffect(() => {
    if (isHost && !didInitDraft.current) {
      didInitDraft.current = true;
      onDraftChange?.(tops, bottoms);
    }
  }, [isHost, onDraftChange, tops, bottoms]);

  // ── 진행 화면(build 후) ──
  if (ladder) {
    return (
      <PlayBoard
        roomId={roomId}
        isHost={isHost}
        ladder={ladder}
        topLabels={topLabels}
        bottomLabels={bottomLabels}
        revealed={revealed}
        resultShown={resultShown}
        onReveal={onReveal}
        onResult={onResult}
        onLeave={onLeave}
      />
    );
  }

  // ── 참가자: 편집 중 호스트의 목록을 실시간으로 본다(ladder:draft). 아직 아무 것도 안 오면 대기. ──
  if (!isHost) {
    const dt = draftTopLabels ?? [];
    const db = draftBottomLabels ?? [];
    const n = Math.max(dt.length, db.length);
    return (
      <Screen>
        <TopBar title="사다리타기" onBack={undefined} />
        <p className="subtitle" style={{ marginTop: -8 }}>호스트가 목록을 정하고 있어요…</p>
        {n === 0 ? (
          <p className="center muted" style={{ marginTop: 40 }}>
            호스트가 사다리를 준비하고 있어요…
          </p>
        ) : (
          <div className="lg-scroll">
            <div className="lg-board" style={{ ['--cols' as string]: n }}>
              <div className="lg-cells lg-tops">
                {Array.from({ length: n }, (_, i) => (
                  <input
                    key={i}
                    className="lg-input"
                    value={dt[i] ?? ''}
                    placeholder="이름"
                    readOnly
                    disabled
                  />
                ))}
              </div>
              <div className="lg-canvas lg-canvas--edit">
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className="lg-preline" />
                ))}
              </div>
              <div className="lg-cells lg-bottoms">
                {Array.from({ length: n }, (_, i) => (
                  <input
                    key={i}
                    className="lg-input"
                    value={db[i] ?? ''}
                    placeholder="당첨 항목"
                    readOnly
                    disabled
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // ── 호스트 편집 화면 ──
  const count = tops.length;
  // 빈 칸이 하나라도 있으면 시작할 수 없다 — 이름·당첨 항목이 비면 결과를 읽을 수 없다.
  const emptyCount =
    tops.filter((v) => !v.trim()).length + bottoms.filter((v) => !v.trim()).length;
  const canBuild = emptyCount === 0;
  return (
    <Screen
      footer={
        <div className="grid-2">
          <Button variant="secondary" onClick={onLeave}>돌아가기</Button>
          <Button onClick={() => onBuild(tops, bottoms)} disabled={!canBuild}>사다리 시작</Button>
        </div>
      }
    >
      <TopBar title="사다리타기" onBack={isHost ? onLeave : undefined} />
      <p className="subtitle" style={{ marginTop: -8 }}>
        {canBuild
          ? '이름과 당첨 항목을 적어주세요.'
          : `아직 ${emptyCount}칸이 비어 있어요 — 다 채우면 시작할 수 있어요.`}
      </p>

      <div className="lg-count">
        <span className="muted">칸 개수</span>
        <div className="lg-stepper">
          <button type="button" onClick={() => setCount(count - 1)} disabled={count <= MIN} aria-label="칸 줄이기">−</button>
          <b>{count}</b>
          <button type="button" onClick={() => setCount(count + 1)} disabled={count >= MAX} aria-label="칸 늘리기">＋</button>
        </div>
      </div>

      <div className="lg-scroll">
        <div className="lg-board" style={{ ['--cols' as string]: count }}>
          <div className="lg-cells lg-tops">
            {tops.map((v, i) => (
              <input
                key={i}
                className="lg-input"
                value={v}
                placeholder="이름"
                maxLength={12}
                onChange={(e) => setTop(i, e.target.value)}
              />
            ))}
          </div>

          <div className="lg-canvas lg-canvas--edit">
            {tops.map((_, i) => (
              <span key={i} className="lg-preline" />
            ))}
          </div>

          <div className="lg-cells lg-bottoms">
            {bottoms.map((v, i) => (
              <input
                key={i}
                className="lg-input"
                value={v}
                placeholder="당첨 항목"
                maxLength={12}
                onChange={(e) => setBottom(i, e.target.value)}
              />
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/** 진행 화면 — 서버 구조로 사다리를 그리고, 공개된 시작칸의 내려오는 경로를 애니메이션한다. */
function PlayBoard({
  isHost,
  ladder,
  topLabels,
  bottomLabels,
  revealed,
  resultShown,
  onReveal,
  onResult,
  onLeave,
}: {
  roomId: string;
  isHost: boolean;
  ladder: LadderStructure;
  topLabels: string[];
  bottomLabels: string[];
  revealed: number[];
  resultShown?: boolean;
  onReveal: (topIndex: number) => void;
  onResult: () => void;
  onLeave: () => void;
}) {
  const cols = Array.from({ length: ladder.columns }, (_, i) => i);
  const revealedSet = new Set(revealed);
  const allRevealed = revealed.length >= ladder.columns;
  // 사다리에는 '가장 최근에 누른' 시작칸 하나만 색으로 남긴다 — 새로 누르면 이전 경로는 되돌아간다.
  // (한 번 누른 칸은 계속 비활성으로 유지해 다시 못 누르게 한다.)
  // '결과 보기'로 결과 모달이 뜬 상태(resultShown)에서는 활성 경로를 없애 — 마지막 칸이 새로 내려오는
  // 애니메이션 없이, 모든 사다리가 정지된(꺼진) 판 위에 결과 창이 뜨게 한다.
  const active = resultShown
    ? null
    : revealed.length
      ? revealed[revealed.length - 1]
      : null;
  // 하단칸(노란색) 하이라이트는 '지금 활성 경로가 바닥에 도착했을 때'에만 켠다.
  //  - 미리 노래지는 것 방지: 경로 애니메이션이 끝나야(onArrive) arrived 가 채워진다.
  //  - 다른 목록의 사다리를 시작하면 active 가 바뀌어 arrived !== active 가 되므로, 켜져 있던
  //    노란색이 그 즉시 회색(기본)으로 꺼진다 — 위 시작칸 색이 꺼지는 것과 같은 타이밍.
  const [arrived, setArrived] = useState<number | null>(null);
  const landed = new Set(
    active !== null && arrived === active ? [ladder.mapping[active]] : [],
  );
  // 이미 사용된(=지금 활성이 아닌, 이전에 공개된) 시작칸들의 도착칸 — 위 목록의 '사용됨'처럼 회색 처리.
  // mapping 은 순열이라 각 도착칸은 시작칸 하나에만 대응하므로 겹치지 않는다.
  const usedBottoms = new Set(
    revealed.filter((s) => s !== active).map((s) => ladder.mapping[s]),
  );

  return (
    <Screen
      footer={
        isHost ? (
          <Button block onClick={onResult}>
            {allRevealed ? '결과 보기' : '결과 보기 (전체 공개)'}
          </Button>
        ) : undefined
      }
    >
      <TopBar title="사다리타기" onBack={isHost ? onLeave : undefined} />
      <p className="subtitle" style={{ marginTop: -8 }}>
        {isHost ? '위 시작점을 누르면 사다리를 타고 내려가요.' : '호스트가 시작점을 누르면 결과가 보여요.'}
      </p>

      <div className="lg-scroll">
        <div className="lg-board" style={{ ['--cols' as string]: ladder.columns }}>
          <div className="lg-cells lg-tops">
            {cols.map((c) => (
              <button
                key={c}
                type="button"
                className={`lg-top${
                  revealedSet.has(c) ? (c === active ? ' is-on' : ' is-used') : ''
                }`}
                style={c === active ? { borderColor: COLORS[c % COLORS.length] } : undefined}
                disabled={!isHost || revealedSet.has(c)}
                onClick={() => onReveal(c)}
              >
                {topLabels[c] || '　'}
              </button>
            ))}
          </div>

          <LadderCanvas
            ladder={ladder}
            active={active}
            onArrive={() => setArrived(active)}
          />

          <div className="lg-cells lg-bottoms">
            {cols.map((c) => (
              <div
                key={c}
                className={`lg-bottom${
                  landed.has(c) ? ' is-on' : usedBottoms.has(c) ? ' is-used' : ''
                }`}
              >
                {bottomLabels[c] || '　'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/** 내려오는 속도를 일정하게 — 단위 길이당 고정 시간(ms). 값이 클수록 느리게 내려온다. */
const MS_PER_UNIT = 5;

/** 경로의 실제 길이(뷰박스 단위) — 세그먼트 거리의 합. 길수록 애니메이션도 오래 걸린다(속도 일정). */
function pathPixelLength(pts: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** 세로줄·가로줄(정적) + 활성 시작칸의 내려오는 경로(그려지는 애니메이션) '하나'만. */
function LadderCanvas({
  ladder,
  active,
  onArrive,
}: {
  ladder: LadderStructure;
  active: number | null;
  onArrive: () => void; // 경로가 바닥에 도착(애니메이션 끝)했을 때 호출 — 하단 하이라이트를 그때 켠다.
}) {
  const w = ladder.columns * COL;
  const pts = active !== null ? tracePath(ladder, active) : null;
  return (
    <svg
      className="lg-canvas"
      viewBox={`0 0 ${w} ${CANVAS_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="사다리"
    >
      {/* 세로줄 */}
      {Array.from({ length: ladder.columns }, (_, c) => (
        <line key={`v${c}`} className="lg-vline" x1={colX(c)} y1={0} x2={colX(c)} y2={CANVAS_H} />
      ))}
      {/* 가로줄 */}
      {ladder.rungs.map((g, i) => (
        <line
          key={`r${i}`}
          className="lg-rung"
          x1={colX(g.col)}
          y1={rungY(ladder, g.row)}
          x2={colX(g.col + 1)}
          y2={rungY(ladder, g.row)}
        />
      ))}
      {/* 활성 시작칸 경로 하나만 — active 가 바뀌면 새로 마운트돼 그려지는 애니메이션이 재생되고,
          이전 경로는 언마운트돼 사라진다(원래대로 돌아감 → 사다리엔 한 색만 남는다). */}
      {pts && active !== null && (
        <Trace
          key={`t${active}`}
          d={toPathD(pts)}
          color={COLORS[active % COLORS.length]}
          durationMs={Math.round(pathPixelLength(pts) * MS_PER_UNIT)}
          onArrive={onArrive}
        />
      )}
    </svg>
  );
}

/** 한 시작칸의 내려오는 경로. 마운트 시 draw 애니메이션(1회). 길이에 비례한 시간으로 속도를 일정하게. */
function Trace({
  d,
  color,
  durationMs,
  onArrive,
}: {
  d: string;
  color: string;
  durationMs: number;
  onArrive: () => void; // 그려지는 애니메이션이 끝나(=바닥 도착) 하단칸을 노랗게 켤 때 호출.
}) {
  const ref = useRef<SVGPathElement | null>(null);
  // pathLength=1 로 정규화해 dash 로 '그려지는' 효과. React가 active 변경 때 새로 마운트하므로 1회 재생.
  useEffect(() => {
    const el = ref.current;
    if (el) el.getBoundingClientRect(); // reflow 강제 → 애니메이션 확실히 시작
  }, []);
  return (
    <path
      ref={ref}
      className="lg-trace"
      d={d}
      pathLength={1}
      style={{ stroke: color, animationDuration: `${durationMs}ms` }}
      onAnimationEnd={onArrive}
    />
  );
}
