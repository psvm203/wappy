import { parseInvitation } from "./invitations";

export function InviteField({
  value,
  onChange,
  server,
}: {
  value: string;
  onChange: (value: string) => void;
  server: string;
}) {
  let destination = "";
  try {
    destination = parseInvitation(value).server ?? server;
  } catch {
    // Show validation errors on submit, not while pasting or typing.
  }
  return (
    <>
      <label className="field">
        친구의 초대 코드 또는 초대장
        <textarea
          required
          rows={5}
          maxLength={2048}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="친구가 보낸 초대장을 통째로 붙여넣어 주세요"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {destination && (
        <p className="hint invitation-destination" role="status">
          초대받은 서버: <strong>{destination}</strong>
        </p>
      )}
    </>
  );
}
