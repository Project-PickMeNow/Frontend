/**
 * 참가자 마스코트 — 로비/로스터 아바타를 닉네임 첫 글자 대신 9종 동물 마스코트 이미지로 보여준다.
 * Figma Mascot 세트(node 297:19)에서 내보낸 이미지들(src/assets/mascots/)을 쓴다.
 *
 * 닉네임 기반 안정 해시로 마스코트를 배정하므로, 같은 닉네임은 재렌더·재접속에도 항상 같은
 * 마스코트를 받는다(무작위처럼 흩어지되 고정적). Vite 가 import 를 최종 에셋 URL 로 바꿔준다.
 */
import mascot1 from '../../assets/mascots/mascot-1.png';
import mascot2 from '../../assets/mascots/mascot-2.png';
import mascot3 from '../../assets/mascots/mascot-3.png';
import mascot4 from '../../assets/mascots/mascot-4.png';
import mascot5 from '../../assets/mascots/mascot-5.png';
import mascot6 from '../../assets/mascots/mascot-6.png';
import mascot7 from '../../assets/mascots/mascot-7.png';
import mascot8 from '../../assets/mascots/mascot-8.png';
import mascot9 from '../../assets/mascots/mascot-9.png';

const MASCOTS = [
  mascot1, mascot2, mascot3, mascot4, mascot5,
  mascot6, mascot7, mascot8, mascot9,
];

export const MASCOT_COUNT = MASCOTS.length;

/** 닉네임 → 고정 마스코트 이미지 URL(간단 해시). 같은 닉네임은 항상 같은 마스코트. */
export function mascotFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MASCOTS[h % MASCOTS.length];
}
