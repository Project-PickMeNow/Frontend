import { useEffect, useRef, useState } from 'react';
import type { CreateRoomInput, GameType } from '../../../shared/types/api';
import { Button, GameIcon, LockIcon } from '../../../shared/ui';

/** 방 만들기 모달에서 고르는 6종 게임. */
const GAMES: { type: GameType; label: string }[] = [
  { type: 'roulette', label: '룰렛' },
  { type: 'vote', label: '투표하기' },
  { type: 'draw', label: '제비뽑기' },
  { type: 'order', label: '순서 정하기' },
  { type: 'balloon', label: '풍선 터뜨리기' },
  { type: 'ladder', label: '사다리타기' },
];

const PIN_MAX = 6;

/**
 * 방 만들기 모달 — '방 만들기'를 누르면 게임 선택 페이지로 넘어가는 대신 여기서
 * (1) 게임 종류 (2) 방 이름 (3) 자유방/비밀방(+숫자 최대 6자리 비밀번호)을 고른 뒤 생성한다.
 *
 * 비밀방으로 만들면 참가자는 코드·QR로 입장할 때 이 비밀번호를 맞춰야 들어올 수 있다
 * (검증은 서버 room:join 에서 — 비밀번호는 해시로만 저장되고 응답에 절대 노출되지 않는다).
 */
export function CreateRoomModal({
  onClose,
  onCreate,
  isPending,
  error,
}: {
  onClose: () => void;
  onCreate: (input: CreateRoomInput) => void;
  isPending: boolean;
  error?: string | null;
}) {
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [title, setTitle] = useState('');
  const [secret, setSecret] = useState(false);
  const [pin, setPin] = useState('');

  const pinValid = pin.length >= 1 && pin.length <= PIN_MAX;
  const canCreate = !!gameType && (!secret || pinValid) && !isPending;

  // isPending prop 은 다음 렌더에야 반영돼, 빠른 더블클릭/더블엔터가 onCreate 를 두 번 쏠 수 있다.
  // 동기 ref 가드로 한 번만 보낸다(요청이 끝나 isPending 이 false 로 돌아오면 다시 허용 — 실패 후 재시도).
  const submittingRef = useRef(false);
  useEffect(() => {
    if (!isPending) submittingRef.current = false;
  }, [isPending]);

  const submit = () => {
    if (!canCreate || !gameType || submittingRef.current) return;
    submittingRef.current = true;
    onCreate({
      gameType,
      title: title.trim() || undefined,
      isSecret: secret,
      password: secret ? pin : undefined,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card crm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="방 만들기"
      >
        <h2 className="title center" style={{ marginTop: 0, fontSize: 22 }}>
          방 만들기
        </h2>
        <p className="subtitle center" style={{ marginTop: -2 }}>
          게임과 방 설정을 고르고 시작해요
        </p>

        {/* 1) 게임 종류 */}
        <p className="section-label crm-label">게임 고르기</p>
        <div className="crm-games">
          {GAMES.map((g) => (
            <button
              key={g.type}
              type="button"
              className={`crm-game${gameType === g.type ? ' is-on' : ''}`}
              onClick={() => setGameType(g.type)}
              aria-pressed={gameType === g.type}
            >
              <GameIcon type={g.type} size={30} />
              <span className="crm-game-label">{g.label}</span>
            </button>
          ))}
        </div>

        {/* 2) 방 이름 */}
        <label className="section-label crm-label" htmlFor="crm-title">
          방 이름 <span className="muted">(선택)</span>
        </label>
        <input
          id="crm-title"
          className="input"
          placeholder="예) 점심 내기"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
        />

        {/* 3) 자유방 / 비밀방 */}
        <p className="section-label crm-label">입장 방식</p>
        <div className="crm-seg" role="tablist" aria-label="입장 방식">
          <button
            type="button"
            role="tab"
            aria-selected={!secret}
            className={`crm-seg-btn${!secret ? ' is-on' : ''}`}
            onClick={() => setSecret(false)}
          >
            자유방
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={secret}
            className={`crm-seg-btn${secret ? ' is-on' : ''}`}
            onClick={() => setSecret(true)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <LockIcon size={15} /> 비밀방
            </span>
          </button>
        </div>

        {secret ? (
          <div className="crm-pin">
            <label className="section-label crm-label" htmlFor="crm-pin">
              비밀번호 <span className="muted">(숫자 최대 {PIN_MAX}자리)</span>
            </label>
            <input
              id="crm-pin"
              className="input crm-pin-input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="숫자 비밀번호"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.nativeEvent.isComposing && submit()
              }
            />
            <p className="muted crm-hint">
              참가자가 코드·QR로 입장할 때 이 비밀번호를 맞춰야 들어올 수 있어요.
            </p>
          </div>
        ) : (
          <p className="muted crm-hint">
            누구나 코드·QR로 바로 입장할 수 있어요.
          </p>
        )}

        {error && (
          <p className="center crm-error">{error}</p>
        )}

        <div className="modal-actions">
          <div className="grid-2">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button onClick={submit} disabled={!canCreate}>
              {isPending ? '만드는 중…' : '방 만들기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
