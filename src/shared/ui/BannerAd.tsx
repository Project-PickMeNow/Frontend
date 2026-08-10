import { useEffect, useRef, useState } from 'react';
import { TossAds } from '@apps-in-toss/web-framework';
import { BANNER_AD_GROUP_ID } from '../lib/ads/adsConfig';
import { useTossAdsStatus } from '../lib/ads/useTossAds';

/**
 * 앱인토스 배너 광고 슬롯.
 *
 * 지켜야 하는 것(토스 애즈 SSP 정책):
 *  - 광고 UI 는 SDK 표준 컴포넌트를 그대로 쓴다. 색·글꼴·문구·'Ad' 표기를 덮어쓰면 정책 위반이다.
 *    그래서 여기서 넘기는 스타일은 SDK 가 허용한 프리셋(theme·tone·variant)뿐이다.
 *  - 갱신(refresh)을 직접 구현하지 않는다. SDK 가 '렌더 후 10초 경과 + 화면 재진입' 조건으로
 *    알아서 갱신한다. 임의 갱신은 무효 트래픽으로 간주된다.
 *  - 버튼 같은 조작 요소와 붙여 두지 않는다(오클릭 유도로 간주) — 배치 여백은 CSS 에서 준다.
 *  - 한 화면에 같은 포맷 광고를 2개 이상 두지 않는다.
 *  - 숨길 땐 `destroy()` 로 DOM 에서 걷어낸다. 투명 처리나 다른 UI 로 가리는 건 '광고 은닉' 위반이다.
 */

type Props = {
  /** 광고 그룹 ID. 기본값은 설정에서 온다(콘솔 발급 전에는 테스트 ID). */
  adGroupId?: string;
  className?: string;
};

type SlotState =
  /** 광고를 붙이는 중 — 자리를 미리 잡아 레이아웃이 밀리지 않게 한다. */
  | 'loading'
  /** 광고가 그려졌다. */
  | 'filled'
  /** 내보낼 광고가 없거나 렌더에 실패했다 — 빈 상자를 남기지 않고 접는다. */
  | 'empty';

export function BannerAd({ adGroupId = BANNER_AD_GROUP_ID, className }: Props) {
  const status = useTossAdsStatus();
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<SlotState>('loading');

  useEffect(() => {
    if (status !== 'ready' || !slotRef.current) return;

    const attached = TossAds.attachBanner(adGroupId, slotRef.current, {
      theme: 'auto', // 시스템 다크모드를 따라간다
      tone: 'blackAndWhite',
      variant: 'card', // 좌우 패딩 + 라운드 — 이 앱의 카드 UI 와 결이 맞는다
      callbacks: {
        onAdRendered: () => setSlot('filled'),
        onNoFill: () => setSlot('empty'),
        onAdFailedToRender: () => setSlot('empty'),
      },
    });

    return () => {
      attached?.destroy();
      setSlot('loading');
    };
  }, [status, adGroupId]);

  // 광고를 못 쓰는 환경(일반 웹 브라우저·구버전 토스앱)이거나 채울 광고가 없으면 흔적을 남기지 않는다.
  if (status !== 'ready' || slot === 'empty') return null;

  return (
    <div className={className ? `banner-ad ${className}` : 'banner-ad'}>
      {/* 광고를 부착할 엘리먼트 — 내부는 반드시 비워 둔다(SDK 가 여기에 광고를 그린다). */}
      <div ref={slotRef} className="banner-ad-slot" />
    </div>
  );
}
