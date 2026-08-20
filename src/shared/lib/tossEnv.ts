import { getOperationalEnvironment } from '@apps-in-toss/web-framework';

/**
 * 토스앱(앱인토스 미니앱) 안에서 돌고 있는지.
 *
 * 이 앱은 일반 웹(Vercel)과 미니앱 양쪽에서 도는데, 토스 SDK 의 브리지 호출은 토스앱 밖에서
 * 그냥 던진다(`... is not a constant handler`). 그래서 판별은 항상 try/catch 로 감싼다.
 * 샌드박스('sandbox')는 브리지가 반쪽만 동작해서 토스앱으로 치지 않는다.
 */
export function isInTossApp(): boolean {
  try {
    return getOperationalEnvironment() === 'toss';
  } catch {
    return false;
  }
}
