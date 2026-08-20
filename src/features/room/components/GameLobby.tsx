import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { GameType } from '../../../shared/types/api';
import { Screen, Button, TopBar, GameIcon, CrownIcon, CopyIcon, BannerAd } from '../../../shared/ui';
import { mascotFor } from '../../../shared/lib/mascot';
import { copyText, copyImageDataUrl } from '../../../shared/lib/clipboard';
import { useRoomStore } from '../store/roomStore';

/** 로비에서 바로 고르는 6종 게임 (호스트: 인라인 전환 / 참가자: 현재 게임 표시) */
const GAMES: { type: GameType; label: string }[] = [
  { type: 'roulette', label: '룰렛' },
  { type: 'vote', label: '투표하기' },
  { type: 'draw', label: '제비뽑기' },
  { type: 'order', label: '순서 정하기' },
  { type: 'balloon', label: '풍선 터뜨리기' },
  { type: 'ladder', label: '사다리타기' },
];
const gameLabel = (gt: GameType | null | undefined) =>
  GAMES.find((g) => g.type === gt)?.label ?? null;

/**
 * 게임 대기방(옛날 온라인 게임 로비 스타일) — 호스트·참가자가 함께 쓰는 공용 로비.
 *
 *  방장 슬롯(👑) + 입장한 참가자 슬롯 + 빈 자리로 로스터를 채운다. 새로 입장하면 그 슬롯이
 *  '입장!' 하며 톡 튀어나온다(닉네임 key 라 새 슬롯만 애니메이션).
 *
 *  호스트: 하단에 [QR 보기](모달로 QR 표시) + [게임 시작 ▶]. 참가자: 시작 버튼 없이 대기.
 *
 * 참가자 목록은 백엔드 계약대로 닉네임 문자열 배열(participant:joined/left · room:state).
 */


export function GameLobby({
  roomId,
  title,
  joinUrl,
  participants,
  readyPlayers,
  isHost,
  me,
  gameType,
  onSelectGame,
  onStart,
  onLeave,
  onDeleteRoom,
  onKick,
}: {
  roomId: string;
  title?: string; // 방 이름(호스트가 방 만들 때 입력). 있으면 상단 제목으로 보여준다.
  joinUrl?: string;
  participants: string[]; // 닉네임 목록
  readyPlayers?: string[]; // 게임 후 로비로 돌아온 참가자(호스트·복귀한 참가자 모두 전달). 없으면 전원 준비된 것으로 본다.
  isHost: boolean;
  me?: string | null; // 내 닉네임(참가자) — 내 슬롯에 '나' 표시
  gameType?: GameType | null; // 현재 선택된 게임 (참가자에게도 실시간 반영)
  onSelectGame?: (gt: GameType) => void; // 호스트: 로비에서 게임 종류 바꾸기
  onStart?: (force?: boolean) => void; // 호스트: 게임 시작(force=true 면 미복귀 참가자 무시)
  onLeave?: () => void; // 참가자: 나가기(확인 모달 → room:leave)
  onDeleteRoom?: () => void; // 호스트: 방 삭제(확인 모달 → room:close, 전원 퇴장)
  onKick?: (nickname: string) => void; // 호스트: 참가자 강퇴(대기로 멈춘 참가자 등)
}) {
  const [qrOpen, setQrOpen] = useState(false);
  // 강퇴 확인 대상(닉네임). null 이면 모달 닫힘.
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  // 뒤로가기·방나가기·방삭제 공통 확인 모달. 확인 시 호스트=방삭제, 참가자=방나가기.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const confirmLeaveAction = () => {
    setConfirmLeave(false);
    if (isHost) onDeleteRoom?.();
    else onLeave?.();
  };
  const [qr, setQr] = useState<string | null>(null);

  // 게임 시작 카운트다운 — 호스트가 '게임 시작 ▶'을 누르면 서버가 준 시각(countdownStartAt)까지
  // 전원이 로비에 머문 채 'N초 뒤 게임으로 들어가요'를 함께 본다(각자 로컬 시계로 동기화).
  const countdownStartAt = useRoomStore((s) => s.countdownStartAt);
  const maxParticipants = useRoomStore((s) => s.maxParticipants);
  const [countdownSecs, setCountdownSecs] = useState(0);
  useEffect(() => {
    if (!countdownStartAt) {
      setCountdownSecs(0);
      return;
    }
    const tick = () =>
      setCountdownSecs(Math.max(0, Math.ceil((countdownStartAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [countdownStartAt]);
  const counting = !!countdownStartAt && countdownSecs > 0;

  useEffect(() => {
    if (!joinUrl) return;
    let alive = true;
    QRCode.toDataURL(joinUrl, { width: 480, margin: 1 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  // 참여 코드 복사 — 클립보드에 방 코드를 넣고 토스트로 알린다(RoomToast).
  // copyText 는 Zoom 웹뷰 등 임베드 환경에서 execCommand 폴백으로 동작한다.
  const copyCode = async () => {
    if (await copyText(roomId)) {
      useRoomStore.getState().pushNotice('참여 코드를 복사했어요');
    } else {
      useRoomStore.getState().pushNotice('복사에 실패했어요. 직접 코드를 입력해 주세요.');
    }
  };

  // QR 복사 — QR '이미지'를 클립보드에 넣는다(모든 환경에서 이미지 우선).
  // copyImageDataUrl 은 data URL 을 fetch 없이 Blob 으로 디코드해 /embed 의 CSP 에도 막히지 않는다.
  // 이미지 클립보드를 지원 안 하거나 권한이 거부된 환경(예: Zoom 웹뷰)에서만 참여 링크로 폴백한다.
  const copyQr = async () => {
    if (!qr) return;
    const pushNotice = useRoomStore.getState().pushNotice;
    if (await copyImageDataUrl(qr)) {
      pushNotice('QR 이미지를 복사했어요');
      return;
    }
    if (joinUrl && (await copyText(joinUrl))) {
      pushNotice('QR 이미지를 복사할 수 없어 참여 링크를 복사했어요');
    } else {
      pushNotice('복사에 실패했어요');
    }
  };

  // 접속 인원 = 실제 명단(방장 1명 + 입장한 참가자). 로스터에 보이는 사람 수와 항상 일치시킨다.
  // (raw 소켓 수 onlineCount 는 입장 전 소켓·중복까지 세어 부정확했다.)
  const live = participants.length + 1;

  // 다음 게임을 시작하려면 현재 참가자 전원이 로비로 돌아와 있어야 한다(전 게임에서 안 돌아온 사람은
  // 60초 뒤 자동 퇴장해 목록에서 빠진다). 아직 안 돌아온 참가자는 로비에 있는 호스트·참가자에게
  // 'WAITING' 으로 보인다. readyPlayers 가 없으면(초기 등) 전원 준비된 것으로 본다.
  const ready = readyPlayers ?? participants;
  // 시작 카운트다운(3·2·1) 중에는 서버가 ready 목록을 이미 비웠다(다음 라운드 복귀를 새로 세려고).
  // 그 3초 동안 로스터가 전원 'WAITING' 으로 깜빡이지 않게, 카운트다운 중엔 대기자가 없는 것으로 본다.
  const pending = counting ? [] : participants.filter((p) => !ready.includes(p));

  return (
    <Screen
      footer={
        isHost ? (
          <div className="grid-2">
            <Button variant="secondary" onClick={() => setQrOpen(true)} disabled={counting}>
              QR 보기
            </Button>
            {pending.length > 0 ? (
              // 일부 참가자가 아직 로비로 안 돌아왔음 — 기다리지 않고 '그래도 시작'할 수 있다.
              // 서버가 그들을 이번 게임에서 빼고 '접속이 늦어 참여 못함' 안내(game:missed)를 보낸다.
              <Button onClick={() => onStart?.(true)} disabled={!gameType || counting}>
                그래도 시작 ({pending.length}명 대기)
              </Button>
            ) : (
              <Button onClick={() => onStart?.()} disabled={!gameType || counting}>
                게임 시작 ▶
              </Button>
            )}
          </div>
        ) : (
          <Button variant="secondary" block onClick={() => setConfirmLeave(true)} disabled={counting}>
            방 나가기
          </Button>
        )
      }
    >
      <TopBar
        title={title?.trim() ? title : '게임 대기방'}
        onBack={counting ? undefined : () => setConfirmLeave(true)}
      />

      <div className="lobby-head">
        <span className="lobby-code">
          참여 코드 <b>{roomId}</b>
          <button
            type="button"
            className="lobby-copy"
            onClick={copyCode}
            aria-label="참여 코드 복사"
            title="참여 코드 복사"
          >
            <CopyIcon size={15} />
          </button>
        </span>
        <span className="lobby-live">
          <i className="lobby-dot" aria-hidden="true" />
          {live} / {maxParticipants}명 접속
        </span>
      </div>

      {/* 게임 종류 — 호스트는 인라인으로 바꾸고(game:select), 참가자는 현재 게임을 실시간으로 본다. */}
      {isHost ? (
        <div className="lobby-games">
          <p className="section-label" style={{ margin: '0 0 8px' }}>게임 고르기</p>
          <div className="lobby-game-grid">
            {GAMES.map((g) => (
              <button
                key={g.type}
                type="button"
                className={`lobby-game${gameType === g.type ? ' is-on' : ''}`}
                onClick={() => onSelectGame?.(g.type)}
              >
                <span className="lobby-game-emoji"><GameIcon type={g.type} size={26} /></span>
                <span className="lobby-game-label">{g.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="lobby-current">
          {gameLabel(gameType) ? (
            <>
              <span className="muted">현재 게임</span>
              <b>{gameLabel(gameType)}</b>
            </>
          ) : (
            <span className="muted">호스트가 게임을 고르고 있어요…</span>
          )}
        </div>
      )}

      <div className="lobby-roster">
        {/* 방장 슬롯 */}
        <div className="lobby-slot is-host">
          <span className="lobby-ava" style={{ background: '#f4b740', color: '#fff' }}>
            <CrownIcon size={19} />
          </span>
          <span className="lobby-name">방장</span>
          <span className="lobby-badge host">HOST</span>
        </div>

        {/* 입장한 참가자 슬롯 (새 참가자는 pop 애니메이션) */}
        {participants.map((nick) => (
          <div key={nick} className="lobby-slot is-in">
            <span className="lobby-ava">
              {/* 닉네임 첫 글자 대신 닉네임 해시로 배정된 동물 마스코트(재렌더에도 동일). */}
              <img className="lobby-ava-img" src={mascotFor(nick)} alt="" aria-hidden="true" />
            </span>
            <span className="lobby-name">{nick}</span>
            {me && nick === me ? (
              <span className="lobby-badge me">나</span>
            ) : ready.includes(nick) || counting ? (
              // 카운트다운 중엔 곧 모두 게임에 들어가므로 READY 로 본다(WAITING 깜빡임 방지).
              <span className="lobby-badge ready">READY</span>
            ) : (
              // 게임이 끝났는데 아직 방으로 안 돌아온 참가자(60초 자동강퇴 전) — 대기 상태로 표시.
              <span className="lobby-badge waiting">WAITING</span>
            )}
            {/* 호스트만 — 참가자 강퇴(대기로 멈춰 시작을 막는 참가자를 내보낸다). */}
            {isHost && onKick && (!me || nick !== me) && (
              <button
                type="button"
                className="lobby-kick"
                onClick={() => setKickTarget(nick)}
                aria-label={`${nick} 내보내기`}
                title="내보내기"
              >
                ✕
              </button>
            )}
          </div>
        ))}

      </div>

      {/* 배너 광고 — 로비는 사람이 모일 때까지 머무는 시간이 길어 노출이 가장 잘 나오는 화면이다.
          참가자 목록과 안내 문구 사이에 두는 이유: 정책상 광고는 버튼과 인접하면 안 되는데
          (의도치 않은 클릭을 유도하는 구조로 본다) 이 자리는 아래를 안내 문구(텍스트)가 받쳐 줘서
          '방 삭제하기' 버튼과 확실히 떨어진다.
          카운트다운 중에는 붙이지 않는다 — 게임으로 넘어가기 직전 몇 초를 광고로 끊지 않는다.
          (언마운트되면서 destroy() 가 불려 DOM 에서도 깨끗이 걷힌다.) */}
      {!counting && <BannerAd />}

      {counting ? (
        <div className="lobby-countdown" role="status" aria-live="assertive">
          <span className="lobby-countdown-num" key={countdownSecs}>
            {countdownSecs}
          </span>
          <span className="lobby-countdown-text">초 뒤 게임으로 들어가요</span>
        </div>
      ) : (
        <p className="center muted lobby-foot">
          {isHost
            ? pending.length > 0
              ? `${pending.length}명이 방으로 돌아오는 중이에요. 모두 돌아오면 새 게임을 시작할 수 있어요.`
              : !gameType
                ? '먼저 게임을 고르고, 준비되면 게임 시작을 눌러요'
                : participants.length === 0
                  ? 'QR 보기로 친구를 초대하고, 다 모이면 게임을 시작하세요'
                  : '사람들이 다 모이면 게임 시작을 눌러요'
            : '호스트가 곧 게임을 시작해요…'}
        </p>
      )}

      {isHost && onDeleteRoom && (
        <button
          type="button"
          className="link-danger"
          style={{ marginTop: 20, alignSelf: 'center' }}
          onClick={() => setConfirmLeave(true)}
        >
          방 삭제하기
        </button>
      )}

      {qrOpen && isHost && (
        <div
          className="modal-backdrop"
          onClick={() => setQrOpen(false)}
          role="presentation"
        >
          <div className="modal-card lobby-qr" onClick={(e) => e.stopPropagation()}>
            <h2 className="title center" style={{ marginTop: 0 }}>
              QR로 초대하기
            </h2>
            <p className="subtitle center" style={{ marginTop: -4 }}>
              참가자가 QR을 찍거나 코드로 입장해요
            </p>

            <div className="lobby-qr-box">
              {qr ? (
                <img src={qr} alt="참여 QR" width={220} height={220} style={{ display: 'block' }} />
              ) : (
                <span className="muted">QR 생성 중…</span>
              )}
            </div>

            <div className="lobby-qr-code">
              참여 코드 <b>{roomId}</b>
              <button
                type="button"
                className="lobby-copy"
                onClick={copyCode}
                aria-label="참여 코드 복사"
                title="참여 코드 복사"
              >
                <CopyIcon size={15} />
              </button>
            </div>
            {joinUrl && <p className="lobby-qr-url">{joinUrl}</p>}

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={copyQr}
                disabled={!qr}
                style={{ marginBottom: 8 }}
              >
                QR 복사
              </Button>
              <Button block onClick={() => setQrOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmLeave(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: 'center' }}
          >
            <p className="title center" style={{ fontSize: 20, marginTop: 0 }}>
              방에서 나가시겠습니까?
            </p>
            <p className="subtitle center">
              {isHost
                ? '방장이 나가면 방이 삭제되고 참가자 전원이 메인 화면으로 나가게 돼요.'
                : '방에서 나가면 다시 참여하려면 코드로 재입장해야 해요.'}
            </p>
            <div className="modal-actions">
              <div className="grid-2">
                <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
                  취소
                </Button>
                <Button onClick={confirmLeaveAction}>
                  {isHost ? '방 삭제하고 나가기' : '나가기'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 강퇴 확인 — 호스트가 참가자를 내보낼 때. */}
      {kickTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setKickTarget(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: 'center' }}
          >
            <p className="title center" style={{ fontSize: 20, marginTop: 0 }}>
              <b>{kickTarget}</b>님을 내보낼까요?
            </p>
            <p className="subtitle center">
              내보낸 참가자는 방에서 나가며, 다시 들어오려면 코드로 재입장해야 해요.
            </p>
            <div className="modal-actions">
              <div className="grid-2">
                <Button variant="secondary" onClick={() => setKickTarget(null)}>
                  취소
                </Button>
                <Button
                  onClick={() => {
                    onKick?.(kickTarget);
                    setKickTarget(null);
                  }}
                >
                  내보내기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
