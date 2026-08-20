import { useEffect, useRef, useState } from 'react';
import type { GameResult, GameType, Item } from '../../../shared/types/api';
import { Screen, Button, TopBar, BalloonIcon } from '../../../shared/ui';
import { ItemEditor } from '../../room/components/ItemEditor';

/**
 * 즉시게임(슬롯·제비뽑기·풍선·사다리) 공용 플레이 화면 — 와이어프레임 ⑧⑨⑩⑪ 기본.
 * 호스트가 시작 버튼 → onStart()(game:start emit) → 서버 game:result → result prop 도착.
 * result 가 오면 잠깐 애니메이션(active) 후 onFinish() 로 결과 화면 전환(룰렛과 같은 흐름).
 * 참가자는 버튼 없이 관전하다 result 가 오면 같은 애니메이션을 본다.
 * (디자인은 추후 수정 예정 — 기본 버전)
 */
/** 항목 상한 — ItemEditor 의 MAX_ITEMS 와 같은 값이어야 한다. */
const MAX_ITEMS = 12;

const META: Record<
  Exclude<GameType, 'roulette' | 'vote'>,
  { title: string; hint: string; action: string; busy: string }
> = {
  order: { title: '순서 정하기', hint: '항목을 무작위 순서로 줄 세워요', action: '순서 정하기', busy: '순서 정하는 중…' },
  draw: { title: '제비뽑기', hint: '제비를 하나 뽑아요', action: '제비 뽑기', busy: '뽑는 중…' },
  balloon: { title: '풍선 터뜨리기', hint: '풍선을 터뜨리면 항목이 나와요', action: '터뜨리기', busy: '터뜨리는 중…' },
  ladder: { title: '사다리타기', hint: '항목을 무작위로 이어요', action: '사다리 타기', busy: '내려가는 중…' },
};

/**
 * 순서 정하기 — 칩(동그라미) 하나.
 * editable(호스트·시작 전)이면 칩을 눌러 라벨을 수정하고(blur/Enter 커밋, 빈 값 원복, Esc 취소)
 * ✕ 로 삭제할 수 있다. 참가자·시작 후에는 읽기 전용 칩으로 보여준다.
 */
function OrderChip({
  item,
  editable,
  onEdit,
  onRemove,
}: {
  item: Item;
  editable: boolean;
  onEdit?: (id: string, label: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.label);
  useEffect(() => setVal(item.label), [item.label]);

  if (!editable) return <span className="order-chip">{item.label}</span>;

  if (editing) {
    const commit = () => {
      const t = val.trim();
      setEditing(false);
      if (!t) {
        setVal(item.label);
        return;
      }
      if (t !== item.label) onEdit?.(item.id, t);
    };
    return (
      <span className="order-chip is-editing">
        <input
          className="order-chip-input"
          value={val}
          maxLength={20}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setVal(item.label);
              setEditing(false);
            }
          }}
          aria-label={`${item.label} 수정`}
        />
      </span>
    );
  }

  return (
    <span className="order-chip is-editable">
      <button
        type="button"
        className="order-chip-label"
        onClick={() => setEditing(true)}
        aria-label={`${item.label} 수정`}
      >
        {item.label}
      </button>
      <button
        type="button"
        className="order-chip-del"
        onClick={() => onRemove?.(item.id)}
        aria-label={`${item.label} 삭제`}
      >
        ✕
      </button>
    </span>
  );
}

export function GameStage({
  gameType,
  items,
  isHost,
  onStart,
  result,
  onFinish,
  onLeave,
  onAddItem,
  onRemoveItem,
  onEditItem,
  onDraftChange,
  orderDraft,
  participants,
}: {
  roomId: string;
  gameType: Exclude<GameType, 'roulette' | 'vote'>;
  items: Item[];
  isHost: boolean;
  onStart?: () => void;
  result?: GameResult | null;
  onFinish?: () => void;
  onLeave?: () => void;
  /** 호스트 전용 — 항목 편집기를 스테이지 위에 함께 보여줄 때 넘긴다. */
  onAddItem?: (label: string) => void;
  onRemoveItem?: (id: string) => void;
  /** 호스트 전용 — 이미 추가한 항목의 내용을 수정한다(id 유지). */
  onEditItem?: (id: string, label: string) => void;
  /** 호스트 전용(순서 정하기) — 입력 중인 항목 텍스트를 참가자 미리보기로 실시간 전송. */
  onDraftChange?: (text: string) => void;
  /** 참가자 전용(순서 정하기) — 호스트가 지금 입력 중인 항목(‘입력 중’ 칩으로 표시). */
  orderDraft?: string;
  /** 호스트 전용(순서 정하기) — 방에 들어와 있는 참가자 닉네임. '참가자 추가하기'에 쓴다. */
  participants?: string[];
}) {
  const meta = META[gameType];
  const [active, setActive] = useState(false);
  // '참가자 추가하기' 확인 모달 — 여러 명이 한 번에 들어가므로 실수로 누르지 않게 한 번 묻는다.
  const [confirmAddPlayers, setConfirmAddPlayers] = useState(false);
  const finishedRef = useRef(false);

  // 결과 도착 → 애니메이션(reel-spin 등) 재생 후 결과 화면으로 전환.
  // 순서 정하기는 긴장감을 조금 더 주려고 재생 시간을 늘렸다.
  useEffect(() => {
    if (!result || finishedRef.current) return;
    finishedRef.current = true;
    setActive(true);
    const t = setTimeout(() => onFinish?.(), 2500);
    return () => clearTimeout(t);
  }, [result, onFinish]);

  // 아직 항목으로 안 들어간 참가자만 추린다(같은 이름 중복 추가 방지). 방장은 넣지 않는다.
  // 상한(MAX_ITEMS)을 넘는 만큼은 자르고, 넘친 인원은 버튼 아래에 알린다.
  const existing = new Set(items.map((it) => it.label.trim().toLowerCase()));
  const missingPlayers = (participants ?? []).filter(
    (nick) => nick.trim() && !existing.has(nick.trim().toLowerCase()),
  );
  const room = Math.max(0, MAX_ITEMS - items.length);
  const addablePlayers = missingPlayers.slice(0, room);
  // 참가자가 아직 없어도 버튼은 보여준다(비활성) — 안 보이면 기능이 있는 줄도 모른다.
  const showAddPlayers = gameType === 'order' && isHost && !!onAddItem && !active;

  const addPlayers = () => {
    addablePlayers.forEach((nick) => onAddItem?.(nick.trim()));
    setConfirmAddPlayers(false);
  };

  const start = () => {
    if (active || items.length < 2) return;
    setActive(true); // 즉시 피드백
    onStart?.();
  };

  return (
    <Screen
      footer={
        isHost ? (
          <Button block onClick={start} disabled={active || items.length < 2}>
            {active ? meta.busy : meta.action}
          </Button>
        ) : undefined
      }
    >
      <TopBar title={meta.title} onBack={isHost ? onLeave : undefined} />
      <p className="subtitle" style={{ marginTop: -8 }}>{meta.hint}</p>

      {isHost && onAddItem && onRemoveItem && (
        <ItemEditor
          items={items}
          onAdd={onAddItem}
          onRemove={onRemoveItem}
          onEdit={onEditItem}
          locked={active}
          onDraftChange={onDraftChange}
          // 순서 정하기는 등록된 항목을 아래 칩에서 직접 수정/삭제하므로 편집기는 '추가'만 담당한다.
          addOnly={gameType === 'order'}
        />
      )}

      {/* 순서 정하기 — 방에 있는 참가자 이름을 한 번에 항목으로 넣는다.
          이름을 하나씩 타이핑하는 게 이 게임에서 제일 번거로운 일이라 지름길을 둔다. */}
      {showAddPlayers && (
        <div className="stage-addplayers">
          <Button
            variant="secondary"
            onClick={() => setConfirmAddPlayers(true)}
            disabled={addablePlayers.length === 0}
          >
            참가자 추가하기
            {addablePlayers.length > 0 && ` (${addablePlayers.length}명)`}
          </Button>
          {(participants ?? []).length === 0 ? (
            <p className="muted stage-addplayers-hint">아직 방에 들어온 참가자가 없어요</p>
          ) : missingPlayers.length === 0 ? (
            <p className="muted stage-addplayers-hint">참가자가 모두 항목에 들어가 있어요</p>
          ) : addablePlayers.length < missingPlayers.length ? (
            <p className="muted stage-addplayers-hint">
              항목은 최대 {MAX_ITEMS}개예요 — {missingPlayers.length - addablePlayers.length}명은 들어가지 않아요
            </p>
          ) : null}
        </div>
      )}

      <div className={`stage-visual${active ? ' active' : ''}`}>
        {gameType === 'order' && (
          <>
            <div className="order-preview">
              {items.map((it) => (
                <OrderChip
                  key={it.id}
                  item={it}
                  editable={isHost && !active}
                  onEdit={onEditItem}
                  onRemove={onRemoveItem}
                />
              ))}
              {/* 참가자 화면 — 호스트가 지금 입력 중인 항목을 '입력 중' 고스트 칩으로 실시간 표시 */}
              {!isHost && orderDraft && orderDraft.trim() && (
                <span className="order-chip" style={{ opacity: 0.5, borderStyle: 'dashed' }}>
                  {orderDraft.trim()}…
                </span>
              )}
            </div>
            {/* 호스트 안내 — 시작 전, 칩을 눌러 수정·삭제할 수 있음을 알린다. */}
            {isHost && !active && items.length > 0 && (
              <p className="center muted" style={{ fontSize: 12.5 }}>
                칩을 눌러 수정 · ✕ 로 삭제
              </p>
            )}
          </>
        )}

        {gameType === 'draw' && (
          <div className="draw-cup">
            {items.slice(0, 8).map((it) => (
              <span key={it.id} className="draw-stick" title={it.label} />
            ))}
          </div>
        )}

        {gameType === 'balloon' && (
          <div className="balloon-grid">
            {items.map((it) => (
              <span key={it.id} className="balloon" title={it.label}><BalloonIcon size={40} /></span>
            ))}
          </div>
        )}

        {gameType === 'ladder' && (
          <div className="ladder">
            <div className="ladder-row">
              {items.slice(0, 5).map((it) => (
                <span key={it.id} className="ladder-cell">{it.label}</span>
              ))}
            </div>
            <div className="ladder-lines">
              {items.slice(0, 5).map((it) => (
                <span key={it.id} className="ladder-line" />
              ))}
            </div>
            <div className="ladder-row">
              {items.slice(0, 5).map((_, i) => (
                <span key={i} className="ladder-cell muted">?</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isHost && (
        <p className="center muted" style={{ fontSize: 13 }}>
          {active ? meta.busy : '호스트가 시작하면 결과가 떠요'}
        </p>
      )}
      {confirmAddPlayers && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmAddPlayers(false)}
          role="presentation"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {/* 한글은 기본 줄바꿈이 어절 중간을 끊는다 — keep-all 로 단어 단위로만 끊고,
                의미가 나뉘는 자리는 <br> 로 직접 끊어 읽기 좋게 만든다. */}
            <p
              className="title center"
              style={{ marginTop: 0, fontSize: 20, lineHeight: 1.35, wordBreak: 'keep-all' }}
            >
              참가자들을
              <br />
              추가하시겠습니까?
            </p>
            <p
              className="subtitle center"
              style={{ fontSize: 14, lineHeight: 1.55, wordBreak: 'keep-all' }}
            >
              방에 있는 참가자 <b>{addablePlayers.length}명</b>의 이름이
              <br />
              항목으로 추가돼요.
            </p>
            <div className="modal-actions">
              <div className="grid-2">
                <Button variant="secondary" onClick={() => setConfirmAddPlayers(false)}>
                  아니오
                </Button>
                <Button onClick={addPlayers}>네</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
