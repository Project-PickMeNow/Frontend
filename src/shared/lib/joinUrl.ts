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
import { useEffect, useState } from 'react';
import { getTossShareLink } from '@apps-in-toss/web-framework';
import { isInTossApp } from './tossEnv';

const PUBLIC_WEB_URL = import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined;

/** 참가자 입장 경로(`/r/:roomId`)의 절대 주소. QR·링크 공유에 그대로 쓴다. */
export function buildJoinUrl(roomId: string): string {
  // ?? 는 빈 문자열을 통과시킨다 — .env 에 `VITE_PUBLIC_WEB_URL=` 처럼 키만 두면
  // base 가 '' 가 돼 링크가 '/r/ABC' 같은 상대경로로 나온다. 빈 값도 폴백시킨다.
  const base = (PUBLIC_WEB_URL?.trim() || window.location.origin).replace(/\/$/, '');
  return `${base}/r/${roomId}`;
}

/**
 * 앱인토스 미니앱의 appName. `granite.config.ts` 의 값과 반드시 같아야 한다.
 * (딥링크 `intoss://{appName}` 가 이 값으로 앱을 찾는다.)
 */
const APP_NAME = 'pickme-now';

/**
 * 참가 링크(QR·복사에 함께 쓴다).
 *
 * 호스트가 **토스앱 미니앱**에서 방을 열었으면 토스 공유 링크를 준다 — 스캔하면 토스앱이 열리고
 * 미니앱의 `/r/:roomId` 로 바로 들어온다. 웹 주소를 그대로 두면 참가자는 브라우저로 새 나가는데,
 * 그러면 미니앱 안에서만 뜨는 광고 노출도 같이 사라진다.
 *
 * 그 밖의 환경(일반 웹·샌드박스)에서는 지금까지처럼 공개 웹 주소를 쓴다.
 * 토스 링크 생성이 실패해도 웹 주소로 남겨 둔다 — 최소한 입장은 되게 하는 게 우선이다.
 *
 * 주의: `intoss://` 딥링크는 앱이 **정식 출시된 뒤에만** 열린다. 출시 전 QR 테스트 빌드에서는
 * 토스앱이 없는 사람과 똑같이 스토어로 빠지므로, 이 경로는 출시 후에 확인해야 한다.
 */
export function useJoinUrl(roomId: string): string {
  const webUrl = buildJoinUrl(roomId);
  const [url, setUrl] = useState(webUrl);

  useEffect(() => {
    setUrl(webUrl);
    if (!isInTossApp()) return;

    let alive = true;
    getTossShareLink(`intoss://${APP_NAME}/r/${roomId}`)
      .then((link) => {
        if (alive && link) setUrl(link);
      })
      .catch(() => {
        // 공유 링크를 못 만들면 웹 주소 그대로 간다.
      });
    return () => {
      alive = false;
    };
  }, [roomId, webUrl]);

  return url;
}
