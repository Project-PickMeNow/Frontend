import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { GameResult, GameType } from '../../shared/types/api';
import { useRoomStore } from '../../features/room/store/roomStore';
import { useRoomConnection } from '../../features/room/socket/useRoomConnection';
import { gameSocket } from '../../features/game/socket/gameSocket';
import { roomSocket } from '../../features/room/socket/roomSocket';
import { GameSelect } from '../../features/room/components/GameSelect';
import { GameLobby } from '../../features/room/components/GameLobby';
import { Roulette } from '../../features/game/components/Roulette';
import { VotePlay } from '../../features/game/components/VotePlay';
import { GameStage } from '../../features/game/components/GameStage';
import { Ladder } from '../../features/game/components/Ladder';
import { DrawPlay } from '../../features/game/components/DrawPlay';
import { BalloonPlay } from '../../features/game/components/BalloonPlay';
import { DrawResult } from '../../features/game/components/results/DrawResult';
import { OrderResult } from '../../features/game/components/results/OrderResult';
import { VoteResult } from '../../features/game/components/results/VoteResult';
import { LadderResult } from '../../features/game/components/results/LadderResult';
import { ResultModal } from '../../features/game/components/results/ResultModal';
import { Loading, Button } from '../../shared/ui';
import { homePath } from '../../shared/lib/embed';
import { useJoinUrl } from '../../shared/lib/joinUrl';

type Phase = 'select' | 'qr' | 'play';

/** 게임 시작 카운트다운 길이(ms) — 백엔드 GameGateway.BEGIN_COUNTDOWN_MS 와 맞춘다. */
const BEGIN_COUNTDOWN_MS = 3000;

/**
 * 호스트 방 — 진행 흐름(local phase) + 결과(store.status).
 *  select : ② 게임 선택 → game:select
 *  qr     : ④ QR 공유·대기
 *  play   : 게임 화면. 항목입력 페이지도, 결과 페이지도 없다 — 각 게임 컴포넌트가
 *           자기 화면 위에 ItemEditor를 얹어 항목을 다루고, 게임이 끝나면(status='finished')
 *           그 게임 화면은 그대로 둔 채 위에 ResultModal이 뜬다(다시하기/홈으로).
 *
 * 룰렛 휠·투표 항목은 winner/tally 의 item.id 가 items[].id 와 일치해야 하므로
 * 연결 시엔 서버 items(store.items)를, offline 이면 로컬 items 를 쓴다.
 */
export function HostRoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // 방 만들기 모달에서 고른 게임 — 있으면 게임 선택 화면을 건너뛰고 바로 로비로 들어간다.
  const presetGameType =
    (location.state as { gameType?: GameType } | null)?.gameType ?? null;
  const socketRef = useRoomConnection(roomId, 'host');
  // 참가 링크 — 토스앱 안에서는 미니앱으로 바로 들어오는 토스 공유 링크, 그 밖에선 공개 웹 주소.
  const joinUrl = useJoinUrl(roomId);

  const status = useRoomStore((s) => s.status);
  const setStatus = useRoomStore((s) => s.setStatus);
  const lobbyReturn = useRoomStore((s) => s.lobbyReturn);
  const storeGameType = useRoomStore((s) => s.gameType);
  const title = useRoomStore((s) => s.title);
  const participants = useRoomStore((s) => s.participants);
  const readyPlayers = useRoomStore((s) => s.readyPlayers);
  const storeItems = useRoomStore((s) => s.items);
  const storeResult = useRoomStore((s) => s.result);
  const tally = useRoomStore((s) => s.tally);
  const voteStatus = useRoomStore((s) => s.voteStatus);
  const voteCloseAt = useRoomStore((s) => s.voteCloseAt);
  const connection = useRoomStore((s) => s.connection);
  const ladder = useRoomStore((s) => s.ladder);
  const ladderTopLabels = useRoomStore((s) => s.ladderTopLabels);
  const ladderBottomLabels = useRoomStore((s) => s.ladderBottomLabels);
  const ladderRevealed = useRoomStore((s) => s.ladderRevealed);
  const ladderResult = useRoomStore((s) => s.ladderResult);
  const draw = useRoomStore((s) => s.draw);
  const drawRound = useRoomStore((s) => s.drawRound);
  const balloon = useRoomStore((s) => s.balloon);
  const balloonRound = useRoomStore((s) => s.balloonRound);

  // 모달에서 게임을 고르고 왔으면 그 게임으로 로비(qr)부터 시작한다. 아니면 옛 흐름대로 게임 선택.
  const [phase, setPhase] = useState<Phase>(presetGameType ? 'qr' : 'select');
  const [gameType, setGameType] = useState<GameType | null>(presetGameType);
  const [localResult, setLocalResult] = useState<GameResult | null>(null);
  // 게임 중/후 호스트 '돌아가기' 확인 모달 — 확인 시 전원(참가자 포함) 로비로 복귀시킨다.
  const [confirmReturn, setConfirmReturn] = useState(false);

  // 재접속·새로고침 등으로 네비게이션 state 를 잃었을 때 — 서버 스냅샷(room:state)의 게임을 채택해
  // 게임 선택 화면에 갇히지 않게 한다. 로컬 gameType 이 이미 있으면 건드리지 않는다.
  useEffect(() => {
    if (!gameType && storeGameType) {
      setGameType(storeGameType);
      setPhase((p) => (p === 'select' ? 'qr' : p));
    }
  }, [gameType, storeGameType]);

  // 게임 시작 카운트다운 후 게임 화면(play)으로 전환하는 시각(epoch ms). 로비 표시용 store 값
  // (countdownStartAt)과 분리해 둔다 — 소켓 핸들러가 startAt 에 그 값을 null 로 지워도 이 전환은
  // 취소되지 않는다(둘을 묶으면 null 처리가 전환 타이머를 함께 죽여 호스트가 로비에 갇힌다).
  const [playAt, setPlayAt] = useState<number | null>(null);
  useEffect(() => {
    if (playAt == null) return;
    const id = setTimeout(() => {
      setPlayAt(null);
      setPhase('play');
    }, Math.max(0, playAt - Date.now()));
    return () => clearTimeout(id);
  }, [playAt]);

  const [myVote, setMyVote] = useState<string | null>(null); // 호스트 본인 투표(한 표)

  // 게임 중단(참가자 이탈 등)으로 서버가 로비 복귀 신호(lobbyReturn 증가)를 보내면 호스트도 로비로 돌아간다.
  // status 로 판단하면 게임 시작 카운트다운 종료 시점에 phase/status 전환 순서가 엇갈려 오작동할 수 있어,
  // 전용 카운터가 바뀔 때만 복귀시킨다(경합 없음).
  const prevLobbyReturn = useRef(lobbyReturn);
  useEffect(() => {
    if (lobbyReturn === prevLobbyReturn.current) return;
    prevLobbyReturn.current = lobbyReturn;
    setPlayAt(null);
    setLocalResult(null);
    setMyVote(null);
    setPhase('qr');
  }, [lobbyReturn]);

  const connected = connection === 'connected';
  const wheelItems = storeItems;

  const chooseGame = (gt: GameType) => {
    setGameType(gt);
    const s = socketRef.current;
    if (s) gameSocket.selectGame(s, gt);
    setPhase('qr');
  };

  // '게임 시작 ▶' — 아직 결과도 항목 편집도 안 끝났지만, game:begin 으로 참가자를
  // 대기 화면에서 실제 게임 화면으로 옮겨 이후 과정(목록 작성·게임 진행)을 실시간으로 보게 한다.
  // 이전 게임 참가자가 다 안 돌아왔으면(PLAYERS_NOT_READY) 서버가 거절 → 로비에 머문다(로비가 안내한다).
  // force=true('그래도 시작') — 아직 로비로 안 돌아온 참가자를 무시하고 시작한다(서버가 그들을 빼고 안내).
  const beginPlay = async (force = false) => {
    const s = socketRef.current;
    if (connected && s) {
      const ack = await gameSocket.beginGame(s, force);
      if (ack && ack.ok === false) return; // 전원 복귀 전 — 화면 전환하지 않고 로비 유지
      // 호스트 전환은 브로드캐스트 수신에 의존하지 않는다 — ack 성공 시 직접 카운트다운을 켠다.
      // countdownStartAt: 로비 표시용(참가자와 동기화). playAt: 호스트 화면 전환용(store 와 분리).
      const at = Date.now() + BEGIN_COUNTDOWN_MS;
      useRoomStore.getState().setCountdownStartAt(at);
      setPlayAt(at);
      return; // 위 effect 가 카운트다운 뒤 play 로 전환한다.
    }
    setPhase('play'); // offline — 카운트다운 없이 바로 전환
  };

  // 방 삭제 — 로비의 뒤로가기/방 삭제하기에서 확인 모달을 거친 뒤 호출된다(여기선 바로 삭제).
  // room:close → 서버가 전원에게 room:closed broadcast + 소켓 해제 → 참가자는 메인으로 튕긴다.
  const deleteRoom = () => {
    const s = socketRef.current;
    if (connected && s) roomSocket.close(s);
    useRoomStore.getState().reset();
    navigate(homePath());
  };

  // 참가자 강퇴 — 대기(WAITING)로 멈춰 게임 시작을 막는 참가자를 호스트가 내보낸다.
  const kickParticipant = (nickname: string) => {
    const s = socketRef.current;
    if (connected && s) roomSocket.kick(s, nickname);
  };

  // 항목 추가/삭제 — 게임 화면 위 ItemEditor에서 한 번에 하나씩 커밋된다(사람이 타이핑하는
  // 속도로 자연히 간격이 생겨, 서버의 read-modify-write 저장이 겹쳐 실행되는 문제가 없다).
  const addItem = (label: string) => {
    const s = socketRef.current;
    if (connected && s) {
      void gameSocket.addItem(s, label); // 서버 → item:added → store.items
    } else {
      const st = useRoomStore.getState();
      st.setItems([...st.items, { id: crypto.randomUUID(), label }]); // offline
    }
  };
  const removeItem = (id: string) => {
    const s = socketRef.current;
    if (connected && s) {
      void gameSocket.removeItem(s, id); // 서버 → item:removed → store.items
    } else {
      const st = useRoomStore.getState();
      st.setItems(st.items.filter((it) => it.id !== id)); // offline
    }
  };
  // 항목 내용 수정 — id 는 유지하고 label 만 바꾼다(순서·투표 집계 보존).
  const editItem = (id: string, label: string) => {
    const s = socketRef.current;
    if (connected && s) {
      gameSocket.editItem(s, id, label); // 서버 → item:updated → store.items
    } else {
      const st = useRoomStore.getState();
      st.setItems(st.items.map((it) => (it.id === id ? { ...it, label } : it))); // offline
    }
  };

  const activeResult = storeResult ?? localResult;
  const rouletteWinner =
    activeResult && activeResult.type === 'roulette' ? activeResult.winner : null;

  // ⑦ 룰렛 '돌리기' — 원판에서 정한 라벨들로 서버 items를 교체(기존 제거 → 순차 추가)한 뒤 게임 시작.
  // 서버가 winner를 계산해 game:result를 전원(참가자 포함) broadcast → 양쪽 원판이 같은 칸으로 착지.
  const spinRoulette = async (labels: string[]) => {
    const s = socketRef.current;
    if (connected && s) {
      for (const it of useRoomStore.getState().items) await gameSocket.removeItem(s, it.id);
      for (const label of labels) await gameSocket.addItem(s, label);
      gameSocket.startGame(s);
    } else {
      // offline — 로컬 항목 세팅 + 로컬 추첨
      const local = labels.map((label) => ({ id: crypto.randomUUID(), label }));
      useRoomStore.getState().setItems(local);
      setLocalResult({
        type: 'roulette',
        winner: local[Math.floor(Math.random() * local.length)],
      });
    }
  };
  const finishPlay = () => setStatus('finished');

  // ⑫ 투표 — 호스트도 한 표 던진다(백엔드가 socket.id 로 1표 집계). 다시 누르면 표 이동.
  const castVote = (itemId: string) => {
    const s = socketRef.current;
    if (connected && s) gameSocket.castVote(s, itemId);
    setMyVote(itemId);
  };
  // ⑫ 투표 '시작'(open) — 이후 참가자·호스트가 투표할 수 있다.
  const startVote = () => {
    const s = socketRef.current;
    if (connected && s) gameSocket.startVote(s);
  };
  // ⑫ 투표 '마감' — 10초 카운트다운을 시작한다(closing).
  const closeVote = () => {
    const s = socketRef.current;
    if (connected && s) gameSocket.closeVote(s);
  };
  // ⑫ 카운트다운 '취소' — 다시 투표를 연다(open).
  const cancelVoteClose = () => {
    const s = socketRef.current;
    if (connected && s) gameSocket.cancelVoteClose(s);
  };
  // ⑫ 카운트다운 0초 — 실제 마감(결과). VotePlay 가 0초에 호출한다.
  const finalizeVote = () => {
    const s = socketRef.current;
    if (connected && s) gameSocket.finalizeVote(s);
  };

  // ⑧ 즉시게임(슬롯) 시작 → game:start. 백엔드가 결과 계산·전원 broadcast.
  // (제비뽑기·풍선은 인터랙티브 흐름이라 이 경로를 안 탄다)
  const startInstant = () => {
    const s = socketRef.current;
    if (s) gameSocket.startGame(s);
  };

  // 풍선 러시안룰렛(턴제) — 시작(호스트)·펌프/넘기기(현재 턴 참가자). 호스트도 턴에 참가한다.
  // 시작 ack 를 반환해 참가자 부족(NEED_MORE_PLAYERS) 등 실패를 BalloonPlay 가 안내한다.
  // useCallback 으로 identity 를 고정한다 — BalloonPlay 의 자동시작 useEffect 가 매 렌더마다
  // 재실행돼 balloon:start 를 중복 emit 하지 않도록(socketRef 는 안정적이라 deps 비움).
  const startBalloon = useCallback(() => {
    const s = socketRef.current;
    return s ? gameSocket.startBalloon(s) : Promise.resolve({ ok: false });
  }, [socketRef]);
  const pumpBalloon = () => {
    const s = socketRef.current;
    return s ? gameSocket.pumpBalloon(s) : Promise.resolve({ ok: false });
  };
  const passBalloon = () => {
    const s = socketRef.current;
    return s ? gameSocket.passBalloon(s) : Promise.resolve({ ok: false });
  };
  // 턴 60초 만료(호스트만) — BalloonPlay 의 카운트다운이 0이 되면 호출한다. deadline 을 토큰으로
  // 보내 서버가 현재 턴과 일치할 때만 자동 펌프/넘기기를 처리한다(늦은·중복 호출은 서버가 무시).
  const timeoutBalloon = (deadline: number) => {
    const s = socketRef.current;
    if (s) gameSocket.timeoutBalloon(s, deadline);
  };

  // ⑪ 사다리(네이버 스타일) — build(칸별 상·하단 라벨) / reveal(시작칸) / result(결과 보기).
  const buildLadder = (topLabels: string[], bottomLabels: string[]) => {
    const s = socketRef.current;
    if (s) gameSocket.buildLadder(s, topLabels, bottomLabels);
  };
  // 사다리 편집 실시간 미리보기 — 호스트가 목록을 정하는 동안 참가자도 같은 목록을 보게 relay 한다.
  const sendLadderDraft = (topLabels: string[], bottomLabels: string[]) => {
    const s = socketRef.current;
    if (connected && s) gameSocket.sendLadderDraft(s, topLabels, bottomLabels);
  };
  const revealLadder = (topIndex: number) => {
    const s = socketRef.current;
    if (s) gameSocket.revealLadder(s, topIndex);
  };
  const showLadderResult = () => {
    const s = socketRef.current;
    if (s) gameSocket.resultLadder(s);
  };

  // 제비뽑기 — 섞기(호스트)·뽑기(호스트도 참가). 뽑기는 ack 로 잠금 실패를 받아 DrawPlay 가 안내한다.
  const shuffleDraw = (count: number, blanks: number) => {
    const s = socketRef.current;
    if (s) gameSocket.shuffleDraw(s, count, blanks);
  };
  const pickDraw = (index: number) => {
    const s = socketRef.current;
    return s ? gameSocket.pickDraw(s, index) : Promise.resolve({ ok: false });
  };
  // 제비뽑기 60초 자동 공개(호스트만) — DrawPlay 의 카운트다운이 0이 되면 호출한다.
  const autoResolveDraw = () => {
    const s = socketRef.current;
    if (s) gameSocket.autoResolveDraw(s);
  };
  // 제비뽑기 설정 실시간 미리보기 — 호스트가 제비 수·꽝 개수를 정하는 동안 참가자도 같은 설정을 보게 relay.
  const sendDrawDraft = (count: number, blanks: number) => {
    const s = socketRef.current;
    if (connected && s) gameSocket.sendDrawDraft(s, count, blanks);
  };
  // 순서 정하기 항목 실시간 미리보기 — 호스트가 입력 중인 항목을 참가자가 '입력 중'으로 본다.
  const sendOrderDraft = (text: string) => {
    const s = socketRef.current;
    if (connected && s) gameSocket.sendOrderDraft(s, text);
  };

  // 라운드를 접어(서버가 결과·투표·사다리·제비 데이터 삭제, 대기 전환) 로비(qr)로 돌아간다.
  //  - notify=false(결과 후 '방으로 돌아가기'): 참가자를 강제 이동시키지 않는다(각자 복귀).
  //  - notify=true(게임 설정 단계 좌측 화살표=게임 취소): 참가자 전원을 로비로 끌어온다.
  // 로비에서 호스트는 게임 종류를 바꾸거나(인라인) 다시 시작할 수 있다.
  const returnToRoom = (notify = false) => {
    const s = socketRef.current;
    if (connected && s) gameSocket.returnToRoom(s, notify); // 서버 데이터 삭제 + status:waiting
    setLocalResult(null);
    setMyVote(null); // 다음 라운드를 위해 호스트 투표 선택 초기화
    const st = useRoomStore.getState();
    st.setResult(null);
    st.setTally([]);
    st.resetLadder();
    st.resetDraw();
    st.resetBalloon();
    st.setStatus('waiting');
    setPhase('qr');
  };

  const goHome = () => {
    useRoomStore.getState().reset();
    // 임베드(익스텐션·Zoom·Meet)면 전체 홈이 아니라 임베드 런처(/embed)로 돌아간다.
    navigate(homePath());
  };

  // 첫 화면(아직 게임도 안 고른 상태)에서 나가기 — 방은 여기서만 실제로 삭제된다(방금 만들고 나가기).
  const leaveBeforeStart = () => {
    const s = socketRef.current;
    if (connected && s) roomSocket.close(s);
    goHome();
  };

  if (phase === 'select') {
    // 새로고침 등으로 게임을 아직 모를 때: 서버 스냅샷(room:state)이 도착하기 전(최초 연결 중)에는
    // 게임 선택 화면을 깜빡이지 않도록 로딩을 보여준다. 스냅샷에 게임이 있으면 위 effect 가 곧 qr 로
    // 넘긴다. 연결이 끝났는데도 게임이 없으면(진짜 미선택) 그때 선택 화면을 띄운다.
    if (connection === 'connecting' && !gameType) return <Loading />;
    return <GameSelect onSelect={chooseGame} onBack={leaveBeforeStart} />;
  }

  if (phase === 'qr') {
    return (
      <GameLobby
        roomId={roomId}
        title={title}
        joinUrl={joinUrl}
        participants={participants}
        readyPlayers={readyPlayers}
        isHost
        gameType={gameType}
        onSelectGame={chooseGame}
        onStart={beginPlay}
        onDeleteRoom={deleteRoom}
        onKick={kickParticipant}
      />
    );
  }

  // play — 게임 화면은 결과가 나온 뒤에도 그대로 남고, 그 위에 결과 모달만 뜬다.
  let content;
  if (gameType === 'vote') {
    content = (
      <VotePlay
        roomId={roomId}
        items={wheelItems}
        tally={tally}
        isHost
        myVote={myVote}
        voteStatus={voteStatus}
        voteCloseAt={voteCloseAt}
        onVote={castVote}
        onStart={startVote}
        onClose={closeVote}
        onCancelClose={cancelVoteClose}
        onFinalize={finalizeVote}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onEditItem={editItem}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  } else if (gameType === 'roulette' || !gameType) {
    content = (
      <Roulette
        items={wheelItems}
        isHost
        winner={rouletteWinner}
        onSpinLabels={spinRoulette}
        onDraftChange={(labels) => {
          const s = socketRef.current;
          if (connected && s) gameSocket.sendRouletteDraft(s, labels);
        }}
        onFinish={finishPlay}
        onReturn={() => returnToRoom()}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  } else if (gameType === 'ladder') {
    // ⑪ 사다리 — 편집(상·하단 라벨·칸 수) → 시작 → 시작칸 공개(내려오는 애니메이션) → 결과 보기
    content = (
      <Ladder
        roomId={roomId}
        isHost
        ladder={ladder}
        topLabels={ladderTopLabels}
        bottomLabels={ladderBottomLabels}
        revealed={ladderRevealed}
        resultShown={!!ladderResult}
        onBuild={buildLadder}
        onReveal={revealLadder}
        onResult={showLadderResult}
        onDraftChange={sendLadderDraft}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  } else if (gameType === 'draw') {
    // 제비뽑기(인터랙티브) — 인원수·꽝 설정 → 섞기 → 호스트·참가자 각자 뽑기(먼저 뽑힌 제비는 잠금)
    content = (
      <DrawPlay
        roomId={roomId}
        isHost
        draw={draw}
        round={drawRound}
        onShuffle={shuffleDraw}
        onPick={pickDraw}
        onAutoResolve={autoResolveDraw}
        onDraftChange={sendDrawDraft}
        // 방 전체 인원(호스트 1명 + 참가자) — 호스트도 제비를 뽑으므로 기본 제비 수를 방 인원과 같게 둔다.
        participantCount={participants.length + 1}
        onReturn={() => returnToRoom()}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  } else if (gameType === 'balloon') {
    // 풍선 러시안룰렛(턴제) — 호스트도 '호스트'로 턴에 참가한다. 자기 턴에 펌프·넘기기.
    content = (
      <BalloonPlay
        roomId={roomId}
        isHost
        me="호스트"
        balloon={balloon}
        round={balloonRound}
        playerCount={participants.length}
        onStart={startBalloon}
        onPump={pumpBalloon}
        onPass={passBalloon}
        onTimeout={timeoutBalloon}
        onReturn={() => returnToRoom()}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  } else {
    // 슬롯 — 즉시게임 (버튼 → game:start → 결과 애니 → 모달)
    content = (
      <GameStage
        roomId={roomId}
        gameType={gameType}
        items={wheelItems}
        isHost
        onStart={startInstant}
        result={activeResult}
        onFinish={finishPlay}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onEditItem={editItem}
        onDraftChange={sendOrderDraft}
        onLeave={() => setConfirmReturn(true)}
      />
    );
  }

  return (
    <>
      {content}
      {/* 룰렛은 모달 대신 원판 윗단 '당첨!' 배너로 결과를 보여준다 — 여기선 제외. */}
      {status === 'finished' && activeResult && activeResult.type !== 'roulette' && (
        <ResultModal onReturn={() => returnToRoom()}>
          {activeResult.type === 'vote' ? (
            <VoteResult result={activeResult} />
          ) : activeResult.type === 'order' ? (
            <OrderResult result={activeResult} />
          ) : (
            <DrawResult result={activeResult} />
          )}
        </ResultModal>
      )}
      {ladderResult && (
        <ResultModal onReturn={() => returnToRoom()}>
          <LadderResult result={ladderResult} />
        </ResultModal>
      )}
      {confirmReturn && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmReturn(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: 'center' }}
          >
            <p className="title center" style={{ fontSize: 20, marginTop: 0 }}>
              정말로 돌아가시겠습니까?
            </p>
            <p className="subtitle center">
              돌아가면 모든 참가자가 방으로 돌아갑니다.
            </p>
            <div className="modal-actions">
              <div className="grid-2">
                <Button variant="secondary" onClick={() => setConfirmReturn(false)}>
                  취소
                </Button>
                <Button
                  onClick={() => {
                    setConfirmReturn(false);
                    returnToRoom(true);
                  }}
                >
                  돌아가기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
