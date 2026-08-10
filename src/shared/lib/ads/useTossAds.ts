import { useEffect, useState } from 'react';
import { TossAds, isMinVersionSupported } from '@apps-in-toss/web-framework';
import { ADS_ENABLED } from './adsConfig';

/**
 * 토스 광고 SDK 초기화.
 *
 * 초기화는 앱 전체에서 딱 한 번만 해야 한다 — 두 번 호출하면 SDK 가
 * `[toss-ad] Already initialized.` 로 실패한다. 그래서 상태를 모듈 스코프에 두고
 * 훅은 그 상태를 구독만 한다(어느 컴포넌트에서 몇 번을 쓰든 안전하다).
 *
 * 이 앱은 일반 웹(Vercel)과 토스 미니앱 양쪽에서 도는데, 광고는 토스앱 안에서만 쓸 수 있다.
 * 그래서 웹에서는 `isSupported()` 가 false 라 'unavailable' 로 끝나고 배너는 아예 붙지 않는다.
 */

/** 배너 광고 API 가 들어온 토스앱 최소 버전. 미만에서는 빈 화면이 노출될 수 있어 붙이지 않는다. */
const MIN_TOSS_APP_VERSION = '5.241.0';

export type TossAdsStatus =
  /** 초기화 진행 중 — 아직 광고를 붙이면 안 된다. */
  | 'pending'
  /** 초기화 완료 — `TossAds.attachBanner` 를 호출할 수 있다. */
  | 'ready'
  /** 이 환경에선 광고를 못 쓴다(웹 브라우저, 구버전 토스앱, 초기화 실패, 킬 스위치 off). */
  | 'unavailable';

let status: TossAdsStatus = 'pending';
let started = false;
const listeners = new Set<() => void>();

function setStatus(next: TossAdsStatus) {
  status = next;
  listeners.forEach((notify) => notify());
}

function ensureInitialized() {
  if (started) return;
  started = true;

  try {
    if (
      !ADS_ENABLED ||
      !TossAds.initialize.isSupported() ||
      !TossAds.attachBanner.isSupported() ||
      !isMinVersionSupported({ android: MIN_TOSS_APP_VERSION, ios: MIN_TOSS_APP_VERSION })
    ) {
      setStatus('unavailable');
      return;
    }

    TossAds.initialize({
      callbacks: {
        onInitialized: () => setStatus('ready'),
        onInitializationFailed: () => setStatus('unavailable'),
      },
    });
  } catch {
    // 토스앱 밖(일반 브라우저)에서 브리지 호출이 던질 수 있다 — 광고만 끄고 앱은 그대로 돌린다.
    setStatus('unavailable');
  }
}

/** 광고 SDK 상태를 구독한다. 첫 호출 시 초기화를 시작한다. */
export function useTossAdsStatus(): TossAdsStatus {
  const [, rerender] = useState(0);

  useEffect(() => {
    ensureInitialized();
    const notify = () => rerender((n) => n + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  return status;
}
