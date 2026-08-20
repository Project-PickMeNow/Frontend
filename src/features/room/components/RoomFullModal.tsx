import { Button } from '../../../shared/ui';
import { MAX_ROOM_MEMBERS } from '../../../shared/lib/roomCapacity';

/**
 * 정원이 찬 방에 들어오려 한 참가자에게 뜨는 안내 모달.
 * 확인을 누르면 메인 화면으로 보낸다(이 방에는 들어갈 방법이 없으므로 되돌릴 곳이 없다).
 * RoomClosedModal 과 같은 셸을 써 톤을 맞춘다.
 */
export function RoomFullModal({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ textAlign: 'center' }}>
        <p
          className="title center"
          style={{ fontSize: 20, marginTop: 0, wordBreak: 'keep-all' }}
        >
          방의 정원이 모두 찼어요
        </p>
        <p className="subtitle center" style={{ wordBreak: 'keep-all' }}>
          이 방은 방장을 포함해 최대 {MAX_ROOM_MEMBERS}명까지 들어갈 수 있어요.
          <br />
          자리가 나면 다시 입장해 주세요.
        </p>
        <div className="modal-actions">
          <Button block onClick={onConfirm}>
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}
