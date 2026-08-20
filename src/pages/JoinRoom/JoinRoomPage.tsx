import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { roomApi } from '../../features/room/api/roomApi';
import { getApiErrorCode } from '../../shared/lib/apiError';
import { useRoomStore } from '../../features/room/store/roomStore';
import type { ErrorCode } from '../../shared/types/api';
import { Screen, Button, Loading, ErrorView, GoHomeButton, LockIcon } from '../../shared/ui';
import { homePath } from '../../shared/lib/embed';
import { MAX_PARTICIPANTS } from '../../shared/lib/roomCapacity';
import { RoomFullModal } from '../../features/room/components/RoomFullModal';

const PIN_MAX = 6;

/**
 * 입장(room:join)이 실패해 이 화면으로 되돌아왔을 때, 폼 위에 바로 보여줄 문구.
 * 별도 에러 페이지로 튕기지 않고 여기서 고쳐 다시 넣게 한다(닉네임 중복·비밀번호·정원).
 */
const JOIN_ERROR_MESSAGE: Partial<Record<ErrorCode, string>> = {
  NICKNAME_TAKEN: '현재 방에서 이미 사용 중인 닉네임이에요. 다른 닉네임으로 입력해 주세요.',
  WRONG_PASSWORD: '비밀번호가 맞지 않아요. 다시 확인해 주세요.',
  ROOM_NOT_STARTED: '아직 방이 열리지 않았어요. 시작 시각 이후에 다시 입장해 주세요.',
};

/** epoch ms → "M월 D일 오전/오후 H시" 로컬 표기. */
function formatStart(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * ⑤ 참가자 · 입장 — QR/코드로 진입해 닉네임(비밀방이면 비밀번호까지)을 넣고 들어간다.
 * 방 코드는 URL(:roomId)에서 자동 채움. 설치·로그인 없이 바로 참여.
 *
 * 방 조회(GET /api/rooms/:id)로 비밀방 여부(isSecret)를 먼저 확정한다 — 조회가 끝나기 전엔
 * 입장을 막아, 비밀방인데 비밀번호칸 없이 들어가는 일을 원천 차단한다. 조회 실패(없는 방·네트워크)면
 * 폼 대신 에러 화면을 띄운다. 입장하기 → 닉네임·비밀번호를 store 에 저장하고 /game/:roomId 로 이동 →
 * GameRoom 의 useRoomConnection 이 room:join { nickname, password } 로 확정한다.
 * 비밀번호가 틀리면 서버가 WRONG_PASSWORD → 이 화면으로 되돌아와 다시 입력한다(닉네임은 유지).
 */
export function JoinRoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // WRONG_PASSWORD 로 되돌아온 경우 이미 알고 있는 닉네임을 미리 채워, 비밀번호만 다시 치게 한다.
  const [nickname, setName] = useState(
    () => useRoomStore.getState().nickname ?? '',
  );
  const [pin, setPin] = useState('');
  // 입장 실패로 되돌아왔으면(GameRoom → navigate state) 그 코드를 폼 위에 인라인으로 알린다.
  const [joinError, setJoinError] = useState<ErrorCode | null>(
    () => (location.state as { joinError?: ErrorCode } | null)?.joinError ?? null,
  );

  // 되돌아오며 남았을 수 있는 store 의 전역 에러를 비운다(이 화면은 인라인으로만 알린다).
  useEffect(() => {
    useRoomStore.getState().setError(null);
  }, []);

  // 비밀방 여부 확인용 방 조회. isSecret 을 확정하기 전엔 입장을 막는다.
  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => roomApi.get(roomId),
    enabled: !!roomId,
    retry: false,
    staleTime: 0,
  });

  // 조회 중 — 비밀방인지 알 수 없으니 입장을 막고 로딩만 보여준다.
  if (isLoading) return <Loading />;

  // 조회 실패 — 없는 방이면 그대로 안내, 그 외(네트워크 등)는 재시도. 입장은 허용하지 않는다.
  if (isError) {
    const code = getApiErrorCode(error);
    return (
      <ErrorView
        code={code === 'ROOM_NOT_FOUND' ? 'ROOM_NOT_FOUND' : undefined}
        title={code === 'ROOM_NOT_FOUND' ? undefined : '방 정보를 불러오지 못했어요'}
        desc={
          code === 'ROOM_NOT_FOUND'
            ? undefined
            : '연결을 확인하고 다시 시도해 주세요.'
        }
        action={
          <div className="stack" style={{ width: '100%' }}>
            <Button block onClick={() => void refetch()} disabled={isFetching}>
              다시 시도
            </Button>
            <GoHomeButton onClick={() => navigate(homePath())} />
          </div>
        }
      />
    );
  }

  const isSecret = summary?.isSecret ?? false;
  const pinOk = !isSecret || (pin.length >= 1 && pin.length <= PIN_MAX);
  // 방 유효기간 시작 전이면(startAt 이 미래) 아직 입장할 수 없다. startAt=0 은 즉시(레거시).
  const startAt = summary?.startAt ?? 0;
  const notStarted = startAt > Date.now();
  // 정원 초과 — 방 조회 결과로 미리 막고(헛걸음 방지), 서버가 ROOM_FULL 로 돌려보낸 경우도 같이 본다.
  // 조회와 실제 입장 사이에 누가 먼저 들어갈 수 있으므로 최종 판정은 언제나 서버 쪽이다.
  const roomFull =
    joinError === 'ROOM_FULL' || (summary?.participantCount ?? 0) >= MAX_PARTICIPANTS;
  const canJoin = !!nickname.trim() && pinOk && !notStarted && !roomFull;

  // 어느 칸에 인라인 안내를 붙일지 — 닉네임 중복은 닉네임 칸, 비밀번호 오류는 비밀번호 칸.
  // (정원 초과는 폼에서 고칠 수 있는 게 아니라 모달로 알리고 메인으로 보낸다.)
  const nickError = joinError === 'NICKNAME_TAKEN';
  const pwError = joinError === 'WRONG_PASSWORD';

  const join = () => {
    const nick = nickname.trim();
    if (!nick || !pinOk || notStarted || roomFull) return;
    setJoinError(null); // 다시 시도하는 순간 이전 안내는 지운다.
    // 이전 방의 잔여 상태를 비우고 닉네임·(비밀방이면)비밀번호·role만 저장하고 이동. 실제 소켓 연결·
    // room:join emit 은 GameRoom 의 useRoomConnection(role:'participant')이 connect 시 자동 처리한다.
    const st = useRoomStore.getState();
    st.reset();
    st.setRoom(roomId, 'participant');
    st.setNickname(nick);
    st.setJoinPassword(isSecret ? pin : null);
    navigate(`/game/${roomId}`);
  };

  return (
    <>
    <Screen
      footer={
        <Button block onClick={join} disabled={!canJoin}>
          입장하기
        </Button>
      }
    >
      <h1 className="title" style={{ fontSize: 24 }}>참여하기</h1>

      {notStarted && (
        <p className="join-error-banner" role="status">
          아직 방이 열리지 않았어요. <b>{formatStart(startAt)}</b>부터 입장할 수 있어요.
        </p>
      )}

      <div className="field" style={{ marginTop: 28 }}>
        <label className="section-label">방 코드</label>
        <input className="input" value={`#${roomId}`} readOnly />
      </div>

      <div className="field" style={{ marginTop: 20 }}>
        <label className="section-label">닉네임</label>
        <input
          className={`input${nickError ? ' is-error' : ''}`}
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={(e) => {
            setName(e.target.value);
            if (nickError) setJoinError(null); // 고치기 시작하면 안내를 지운다.
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && join()}
          maxLength={12}
          autoFocus={!nickname || nickError}
        />
        {nickError && (
          <p className="field-error">{JOIN_ERROR_MESSAGE.NICKNAME_TAKEN}</p>
        )}
      </div>

      {isSecret && (
        <div className="field" style={{ marginTop: 20 }}>
          <label className="section-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <LockIcon size={14} /> 비밀번호
            </span>
          </label>
          <input
            className={`input${pwError ? ' is-error' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder={`숫자 최대 ${PIN_MAX}자리`}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX));
              if (pwError) setJoinError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && join()}
            autoFocus={!!nickname && !nickError}
          />
          {pwError ? (
            <p className="field-error">{JOIN_ERROR_MESSAGE.WRONG_PASSWORD}</p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              이 방은 비밀방이에요. 호스트에게 받은 비밀번호를 입력해 주세요.
            </p>
          )}
        </div>
      )}

      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        설치·로그인 없이 바로 참여해요
      </p>
    </Screen>
      {/* 정원이 찼으면 폼 위에 안내를 덮고, 확인을 누르면 메인으로 보낸다. */}
      {roomFull && <RoomFullModal onConfirm={() => navigate(homePath())} />}
    </>
  );
}
