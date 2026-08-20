import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { roomApi } from '../../features/room/api/roomApi';
import { getApiErrorCode } from '../../shared/lib/apiError';
import { useRoomStore } from '../../features/room/store/roomStore';
import { RoomClosedModal } from '../../features/room/components/RoomClosedModal';
import { CreateRoomModal } from '../../features/room/components/CreateRoomModal';
import { Screen, Button, BannerAd } from '../../shared/ui';
import { SoundToggle } from '../../shared/ui/SoundToggle';
import {
  RouletteIcon,
  BalloonIcon,
  LadderIcon,
  DrawIcon,
  OrderIcon,
  GameIcon,
} from '../../shared/ui';
import type { CreateRoomInput, GameType } from '../../shared/types/api';

/**
 * ① 홈 — 호스트 진입(방 만들기) + 참가자 진입(참여 코드 입력).
 * 와이어프레임 '① 홈 · 개선안'(Figma 296:20) 디자인 적용:
 *   브랜드 → 헤드라인 → 결정 스피너 히어로(룰렛 + 떠 있는 게임 아이콘) → 6종 힌트 → CTA.
 *   방 만들기 → POST /api/rooms → /host/:roomId · 코드 입력 → /r/:code
 */

// 6종 힌트 줄에 쓰는 게임 순서(와이어프레임과 동일).
const HINT_GAMES: GameType[] = ['roulette', 'vote', 'draw', 'order', 'balloon', 'ladder'];

// 각 게임의 이름 + 한 줄 설명 — 홈 화면 아이콘을 호버/클릭하면 그 아래에 보여준다.
const GAME_INFO: Record<GameType, { label: string; desc: string }> = {
  roulette: { label: '룰렛', desc: '원판을 돌려 당첨 하나를 뽑아요' },
  vote: { label: '투표하기', desc: '다 같이 투표해서 최다 득표를 정해요' },
  draw: { label: '제비뽑기', desc: '제비를 뽑아 꽝을 피해요' },
  order: { label: '순서 정하기', desc: '항목을 무작위 순서로 줄 세워요' },
  balloon: { label: '풍선 터뜨리기', desc: '돌아가며 펌프하다 터뜨린 사람이 걸려요' },
  ladder: { label: '사다리타기', desc: '사다리를 타고 내려가 짝을 정해요' },
};

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // 홈 게임 아이콘 설명 — 호버(hoverGame)가 우선, 클릭으로 고정(pinnedGame). 둘 다 없으면 안내 문구.
  const [hoverGame, setHoverGame] = useState<GameType | null>(null);
  const [pinnedGame, setPinnedGame] = useState<GameType | null>(null);
  const shownGame = hoverGame ?? pinnedGame;
  // 호스트가 방을 삭제해 메인으로 튕겨온 참가자에게 알림 모달을 띄운다.
  // 이 신호는 참가자 화면(GameRoomPage)이 navigate state 로만 넘긴다 — 호스트(/host)는 이 경로가
  // 없어 스스로 방을 삭제해도 이 모달이 절대 뜨지 않는다.
  const navState = location.state as { roomDeleted?: boolean; kicked?: boolean } | null;
  const roomDeleted = navState?.roomDeleted ?? false;
  // 강퇴(room:kicked)로 튕겨온 참가자 — '방 삭제'와 구분해 강퇴 전용 문구를 띄운다.
  const kicked = navState?.kicked ?? false;

  const create = useMutation({
    // 게임 종류·방 이름·비밀방 여부는 방 만들기 모달에서 고른다(CreateRoomModal).
    mutationFn: (input: CreateRoomInput) => roomApi.create(input),
    onSuccess: (data, variables) => {
      if (!data) return;
      // 이전 방의 잔여 상태(items·result·status 등)를 비우고 새 방으로 진입한다.
      const st = useRoomStore.getState();
      st.reset();
      st.setRoom(data.roomId, 'host');
      st.setHostToken(data.hostToken);
      // 모달에서 고른 게임을 넘겨, 호스트가 게임 선택 화면을 건너뛰고 바로 로비로 들어가게 한다.
      navigate(`/host/${data.roomId}`, { state: { gameType: variables.gameType } });
    },
  });

  // 방 생성 실패 메시지(모달에 표시).
  const createErr = create.isError
    ? getApiErrorCode(create.error) === 'VALIDATION_ERROR'
      ? '입력을 확인해 주세요.'
      : '방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
    : null;

  const enter = () => {
    const c = code.trim().replace(/^#/, '').toUpperCase();
    if (c) navigate(`/r/${c}`);
  };

  return (
    <>
      <Screen>
        {/* 브랜드 줄 — "Pick Me Now" 와 효과음 토글을 같은 선상에 둔다. */}
        <div className="brand-row">
          <p className="brand">Pick Me Now</p>
          <SoundToggle floating={false} />
        </div>

        <div className="home-headline">
          <h1 className="title">오늘 뭐 정할까요?</h1>
          <p className="subtitle">설치도 로그인도 없이, 친구들과 바로 정해요</p>
        </div>

        {/* 결정 스피너 히어로 — 가운데 룰렛을 중심으로 게임 아이콘이 떠 있는 브랜드 무드 */}
        <div className="home-hero" aria-hidden="true">
          <span className="home-hero-glow" />
          <RouletteIcon className="home-spinner" size={124} />
          <BalloonIcon className="home-accent acc-tl" size={34} />
          <LadderIcon className="home-accent acc-tr" size={30} />
          <DrawIcon className="home-accent acc-bl" size={34} />
          <OrderIcon className="home-accent acc-br" size={32} />
          <span className="home-verb">돌리고 · 뽑고 · 터뜨려서 정해요</span>
        </div>

        {/* 현재 총 6가지의 게임 — 아이콘을 호버/클릭하면 아래에 간략한 설명이 뜬다. */}
        <div className="home-hint">
          <p className="home-hint-cap">현재 총 6가지의 게임이 있어요</p>
          <div className="home-hint-icons">
            {HINT_GAMES.map((g) => (
              <button
                key={g}
                type="button"
                className={`home-hint-icon${pinnedGame === g ? ' is-on' : ''}`}
                onMouseEnter={() => setHoverGame(g)}
                onMouseLeave={() => setHoverGame(null)}
                onFocus={() => setHoverGame(g)}
                onBlur={() => setHoverGame(null)}
                onClick={() => setPinnedGame((cur) => (cur === g ? null : g))}
                aria-label={GAME_INFO[g].label}
                aria-pressed={pinnedGame === g}
              >
                <GameIcon type={g} size={22} />
              </button>
            ))}
          </div>
          <p className="home-hint-desc">
            {shownGame ? (
              <>
                <b>{GAME_INFO[shownGame].label}</b> · {GAME_INFO[shownGame].desc}
              </>
            ) : (
              <span className="muted">아이콘을 누르면 설명이 나와요</span>
            )}
          </p>
        </div>

        {/* 배너 광고 — 홈은 조작이 없는 대기 화면이라 광고가 흐름을 끊지 않는다.
            아래 spacer 와 자체 여백으로 CTA 버튼과 충분히 떨어뜨린다(오클릭 유도 방지). */}
        <BannerAd />

        <div className="spacer" />

        <div className="stack">
          <Button onClick={() => setCreateOpen(true)}>
            방 만들기 (호스트)
          </Button>

          <p className="center muted" style={{ fontSize: 14 }}>또는</p>

          <div className="home-join">
            <input
              className="input"
              placeholder="참여 코드 입력"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && enter()}
              inputMode="text"
              autoCapitalize="characters"
            />
            <Button variant="secondary" block={false} onClick={enter} style={{ flexShrink: 0 }}>
              입장
            </Button>
          </div>
        </div>
      </Screen>
      {createOpen && (
        <CreateRoomModal
          isPending={create.isPending}
          error={createErr}
          onClose={() => {
            if (!create.isPending) {
              create.reset();
              setCreateOpen(false);
            }
          }}
          onCreate={(input) => create.mutate(input)}
        />
      )}
      {(roomDeleted || kicked) && (
        <RoomClosedModal
          title={kicked ? '방장에 의해 강퇴되었습니다' : undefined}
          subtitle={kicked ? '방장이 회원님을 방에서 내보내 메인 화면으로 돌아왔어요.' : undefined}
          onConfirm={() => {
            useRoomStore.getState().reset();
            navigate('/', { replace: true }); // state 를 비워 모달을 닫는다(뒤로가기로 다시 안 뜨게).
          }}
        />
      )}
    </>
  );
}
