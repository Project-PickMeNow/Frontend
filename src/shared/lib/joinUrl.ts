/**
 * 참가 링크(QR) 주소 생성.
 *
 * 왜 `window.location.origin` 을 쓰면 안 되는가:
 *  - 앱인토스 미니앱은 번들이 `https://<appName>.private-apps.tossmini.com`(테스트) /
 *    `https://<appName>.apps.tossmini.com`(출시) 오리진에서 서빙된다.
 *  - 이 호스트들은 토스앱 웹뷰 밖에서 열리지 않는다(각각 403·503). 그래서 호스트가 미니앱에서
 *    방을 열면 QR 에 그 주소가 박혀 참가자가 아예 입장하지 못한다.
 *
 * 참가자는 설치 없이 들어오는 게 이 서비스의 전제이므로, 참가 링크는 실행 환경과 무관하게
 * 항상 공개 웹 주소를 가리켜야 한다. 그 주소를 빌드 타임에 `VITE_PUBLIC_WEB_URL` 로 주입한다.
 *
 * 값이 없으면(로컬 개발) 현재 오리진으로 폴백한다 — 로컬에서는 그게 맞는 동작이다.
 */
const PUBLIC_WEB_URL = import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined;

/** 참가자 입장 경로(`/r/:roomId`)의 절대 주소. QR·링크 공유에 그대로 쓴다. */
export function buildJoinUrl(roomId: string): string {
  const base = (PUBLIC_WEB_URL ?? window.location.origin).replace(/\/$/, '');
  return `${base}/r/${roomId}`;
}
