import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CHARACTER_NAMES,
  MAX_NAME_LENGTH,
  parseProfile,
  type ProfileInput,
} from "@wappy/api";
import { Character } from "./Character";
import { errorMessage } from "./api";

const CHARACTER_CATEGORIES = {
  치이카와: [
    "chiikawa",
    "hachiware",
    "usagi",
    "momonga",
    "kurimanju",
    "rakko",
    "shisa",
    "furuhonya",
  ],
  산리오: [
    "pochacco",
    "badtz-maru",
    "hangyodon",
    "pekkle",
    "tuxedosam",
    "keroppi",
  ],
  어벤져스: [
    "ironman",
    "captain-america",
    "thor",
    "hulk",
    "black-widow",
    "hawkeye",
  ],
} satisfies Record<string, ProfileInput["character"][]>;

export function ProfileForm({
  initial,
  busy,
  onSave,
  children,
  beforeProfile,
  canSave = true,
  autoSave = false,
}: {
  initial: ProfileInput;
  busy: boolean;
  onSave: (profile: ProfileInput) => void | Promise<void>;
  children?: ReactNode;
  beforeProfile?: ReactNode;
  canSave?: boolean;
  autoSave?: boolean;
}) {
  const [profile, setProfile] = useState(initial);
  const draft = useRef(initial);
  const submitted = useRef<ProfileInput | null>(initial);
  const saveAttempt = useRef(0);
  const edited = useRef(false);
  const composing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveError, setSaveError] = useState("");

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (edited.current) return;
    draft.current = initial;
    submitted.current = initial;
    setProfile(initial);
  }, [initial.name, initial.character]);

  async function saveChanges() {
    window.clearTimeout(timer.current);
    if (!autoSave || composing.current) return;
    let next: ProfileInput;
    try {
      next = parseProfile(draft.current);
    } catch (cause) {
      setSaveError((cause as Error).message);
      return;
    }
    if (
      next.name === submitted.current?.name &&
      next.character === submitted.current?.character
    )
      return;
    const attempt = ++saveAttempt.current;
    submitted.current = next;
    setSaveError("");
    setSaveStatus("saving");
    try {
      await onSave(next);
      if (saveAttempt.current === attempt)
        setSaveStatus(
          draft.current.name.trim() === next.name &&
            draft.current.character === next.character
            ? "saved"
            : "idle",
        );
    } catch (cause) {
      if (saveAttempt.current !== attempt) return;
      submitted.current = null;
      setSaveStatus("idle");
      setSaveError(errorMessage(cause));
    }
  }

  function changeProfile(next: ProfileInput, delay = 0) {
    edited.current = true;
    draft.current = next;
    setProfile(next);
    window.clearTimeout(timer.current);
    if (!autoSave || composing.current) return;
    setSaveError("");
    setSaveStatus("idle");
    if (delay)
      timer.current = window.setTimeout(() => void saveChanges(), delay);
    else void saveChanges();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !canSave) return;
    if (autoSave) {
      void saveChanges();
      return;
    }
    void onSave({
      name: profile.name.trim(),
      character: profile.character,
    });
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <fieldset disabled={busy}>
        <legend>나를 닮은 친구를 골라요</legend>
        {beforeProfile}
        {Object.entries(CHARACTER_CATEGORIES).map(([category, characters]) => (
          <section key={category} aria-label={category}>
            <h2 className="character-category-title">{category}</h2>
            <div className="character-picker">
              {characters.map((kind) => (
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
                    onChange={() =>
                      changeProfile({ ...draft.current, character: kind })
                    }
                  />
                  <Character kind={kind} />
                  <span>{CHARACTER_NAMES[kind]}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        <label className="field">
          이름
          <input
            autoComplete="nickname"
            required
            maxLength={MAX_NAME_LENGTH}
            placeholder="친구들이 부를 이름"
            value={profile.name}
            onChange={(event) =>
              changeProfile({ ...draft.current, name: event.target.value }, 300)
            }
            onCompositionStart={() => {
              composing.current = true;
              window.clearTimeout(timer.current);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              changeProfile(
                { ...draft.current, name: event.currentTarget.value },
                300,
              );
            }}
            onBlur={() => void saveChanges()}
          />
        </label>
        {children}
        {autoSave ? (
          saveError ? (
            <p className="error" role="alert">
              {saveError}
              <button type="button" onClick={() => void saveChanges()}>
                다시 저장
              </button>
            </p>
          ) : (
            <p className="hint" role="status">
              {saveStatus === "saving"
                ? "저장하는 중…"
                : saveStatus === "saved"
                  ? "저장했어요."
                  : "변경하면 자동으로 저장돼요."}
            </p>
          )
        ) : (
          <button
            className="primary"
            disabled={!profile.name.trim() || !canSave}
            type="submit"
          >
            {busy ? "저장하는 중…" : "이 모습으로 함께하기"}
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </fieldset>
    </form>
  );
}
