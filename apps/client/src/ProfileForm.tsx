import { useState, type FormEvent, type ReactNode } from "react";
import {
  CHARACTERS,
  CHARACTER_NAMES,
  MAX_NAME_LENGTH,
  type ProfileInput,
} from "@wappy/api";
import { Character } from "./Character";

export function ProfileForm({
  initial,
  busy,
  onSave,
  children,
  beforeProfile,
  canSave = true,
  submitLabel = "이 모습으로 함께하기",
}: {
  initial: ProfileInput;
  busy: boolean;
  onSave: (profile: ProfileInput) => void;
  children?: ReactNode;
  beforeProfile?: ReactNode;
  canSave?: boolean;
  submitLabel?: string;
}) {
  const [profile, setProfile] = useState(initial);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !canSave) return;
    onSave({
      name: profile.name.trim(),
      character: profile.character,
    });
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <fieldset disabled={busy}>
        <legend>나를 닮은 친구를 골라요</legend>
        {beforeProfile}
        <div className="character-picker">
          {CHARACTERS.map((kind) => (
            <label
              className={`character-option ${profile.character === kind ? "selected" : ""}`}
              key={kind}
            >
              <input
                type="radio"
                name="character"
                aria-label={CHARACTER_NAMES[kind]}
                value={kind}
                checked={profile.character === kind}
                onChange={() => setProfile({ ...profile, character: kind })}
              />
              <Character kind={kind} />
              <span>{CHARACTER_NAMES[kind]}</span>
            </label>
          ))}
        </div>
        <label className="field">
          이름
          <input
            autoComplete="nickname"
            required
            maxLength={MAX_NAME_LENGTH}
            placeholder="친구들이 부를 이름"
            value={profile.name}
            onChange={(event) =>
              setProfile({ ...profile, name: event.target.value })
            }
          />
        </label>
        {children}
        <button
          className="primary"
          disabled={!profile.name.trim() || !canSave}
          type="submit"
        >
          {busy ? "저장하는 중…" : submitLabel}
          <span aria-hidden="true">↗</span>
        </button>
      </fieldset>
    </form>
  );
}
