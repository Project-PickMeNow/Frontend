import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * 앱인토스(Apps in Toss) 미니앱 설정.
 *
 * `npm run build`(= `ait build`)가 이 파일을 읽어 `web.commands.build`로 웹을 빌드한 뒤
 * `outdir`의 정적 결과물을 패키징해 루트에 `<appName>.ait` 번들을 만든다.
 *
 * appName은 앱을 식별하는 고유 키다 — 콘솔 '앱 정보'에 등록한 값과 반드시 같아야 하고,
 * 딥링크(intoss://{appName})와 배포에도 그대로 쓰인다.
 */
export default defineConfig({
  appName: 'pickme-now',
  brand: {
    displayName: '픽미나우',
    primaryColor: '#4f46e5', // index.css의 --accent(인디고) — 선택·진행바·강조 색
    // 콘솔 '앱 정보'에 등록한 아이콘과 반드시 같은 이미지여야 한다(다르면 검수에서 반려된다).
    icon: 'https://static.toss.im/appsintoss/66977/a39a20ef-31cd-49ff-a362-73c6af752b90.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
