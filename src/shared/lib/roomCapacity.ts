/**
 * 게임 대기방 정원.
 *
 * 실제 차단은 서버(room:join → ROOM_FULL)가 해야 한다 — 여기 값은 입장 화면에서 미리 막아
 * 헛걸음을 줄이기 위한 것이고, 서버 정책과 같은 값으로 유지해야 한다.
 */

/** 방에 있을 수 있는 총 인원 — 방장 포함. */
export const MAX_ROOM_MEMBERS = 12;

/**
 * 방장을 뺀 참가자 정원.
 * 서버의 `participantCount`·`participants` 도 방장을 세지 않으므로 이 값과 비교한다.
 */
export const MAX_PARTICIPANTS = MAX_ROOM_MEMBERS - 1;
