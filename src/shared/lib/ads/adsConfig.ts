/**
 * 앱인토스 인앱 광고 설정.
 *
 * 광고 그룹 ID 는 콘솔에서 발급받는다(사업자 정보 등록 → 정산 정보 등록 → 광고 그룹 생성).
 * 발급 전까지는 아래 테스트 ID 로 개발한다 — 실제 ID 로 테스트하면 무효 트래픽으로 간주되어
 * 광고 제한·정산 보류 같은 제재를 받을 수 있다.
 */

/** 개발용 테스트 광고 그룹 ID(배너 - 리스트형). 콘솔 발급 ID 가 없을 때의 폴백. */
const TEST_BANNER_AD_GROUP_ID = 'ait-ad-test-banner-id';

const configuredGroupId = (import.meta.env.VITE_ADS_BANNER_GROUP_ID as string | undefined)?.trim();

/** 배너 광고 그룹 ID. 콘솔에서 실제 ID 를 받으면 `.env` 값만 채우면 된다. */
export const BANNER_AD_GROUP_ID = configuredGroupId || TEST_BANNER_AD_GROUP_ID;

/** 실제 광고 ID 로 서빙 중인지. 테스트 ID 로 도는 동안엔 수익이 잡히지 않는다. */
export const IS_TEST_AD = BANNER_AD_GROUP_ID === TEST_BANNER_AD_GROUP_ID;

/**
 * 광고 전체 킬 스위치.
 * 광고가 레이아웃을 깨거나 정책 이슈가 생기면 `VITE_ADS_ENABLED=false` 로 재배포해
 * 코드 수정 없이 광고만 내릴 수 있다. 값이 없으면 켜진 상태로 본다.
 */
export const ADS_ENABLED = (import.meta.env.VITE_ADS_ENABLED as string | undefined) !== 'false';
