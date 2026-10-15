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
  메이플스토리: [
    "slime",
    "orange-mushroom",
    "pink-bean",
    "stone-spirit",
    "yeti",
  ],
  "짱구는 못말려": ["shinchan", "kazama", "nene", "masao", "bochan"],
} satisfies Record<string, ProfileInput["character"][]>;

type CharacterCategory = keyof typeof CHARACTER_CATEGORIES;

function categoryFor(character: ProfileInput["character"]): CharacterCategory {
  return Object.entries(CHARACTER_CATEGORIES).find(([, characters]) =>
    characters.some((candidate) => candidate === character),
  )![0] as CharacterCategory;
}

export function ProfileForm({
  initial,
  busy,
  onChange,
  onSave,
  children,
  beforeProfile,
  canSave = true,
  autoSave = false,
}: {
  initial: ProfileInput;
  busy: boolean;
  onChange?: (profile: ProfileInput) => void;
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
  const [saveError, setSaveError] = useState("");
  const [category, setCategory] = useState(() =>
    categoryFor(initial.character),
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // oxlint-disable react-hooks/exhaustive-deps -- Resync only when profile fields change; object identity changes on every server snapshot.
  useEffect(() => {
    if (edited.current) return;
    draft.current = initial;
    submitted.current = initial;
    setProfile(initial);
    setCategory(categoryFor(initial.character));
  }, [initial.name, initial.character]);
  // oxlint-enable react-hooks/exhaustive-deps

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
    try {
      await onSave(next);
    } catch (cause) {
      if (saveAttempt.current !== attempt) return;
      submitted.current = null;
      setSaveError(errorMessage(cause));
    }
  }

  function changeProfile(next: ProfileInput, delay = 0) {
    edited.current = true;
    draft.current = next;
    setProfile(next);
    onChange?.(next);
    window.clearTimeout(timer.current);
    if (!autoSave || composing.current) return;
    setSaveError("");
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
  const nameField = (
    <label
      className="
        field m-[15px_0] block text-[11px] text-[#68725d] [&_:is(input,select,textarea)]:mt-[8px]
        [&_:is(input,select,textarea)]:block [&_:is(input,select,textarea)]:w-full
        [&_:is(input,select,textarea)]:rounded-[9px] [&_:is(input,select,textarea)]:border
        [&_:is(input,select,textarea)]:border-solid [&_:is(input,select,textarea)]:border-[#e0e5d8]
        [&_:is(input,select,textarea)]:bg-[#f4f5ef] [&_:is(input,select,textarea)]:p-[12px]
        [&_:is(input,select,textarea)]:text-[12px] [&_:is(input,select,textarea)]:text-[#3e4935]
        [&_input::placeholder]:text-[11px] [&_input::placeholder]:text-[#68745e] [&_textarea]:resize-y
        [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere
      "
    >
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
  );
  return (
    <form
      onSubmit={submit}
      className="
        profile-form [&_fieldset]:m-0 [&_fieldset]:min-w-0 [&_fieldset]:p-0 [&_fieldset]:[border:0]
        [&_fieldset_>_.field:first-child]:mt-0
      "
    >
      <fieldset disabled={busy} aria-label="프로필 설정">
        {beforeProfile}
        {nameField}
        <div
          className="character-categories mb-[10px] flex gap-[5px] overflow-x-auto pb-[2px]"
          role="tablist"
          aria-label="캐릭터 카테고리"
        >
          {Object.keys(CHARACTER_CATEGORIES).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={category === name}
              className="
                shrink-0 rounded-[8px] bg-[#f0f1e9] p-[8px_9px] text-[10px] whitespace-nowrap
                text-[#68745e] aria-selected:bg-[#e3edd3] aria-selected:font-bold
                aria-selected:text-[#374936]
              "
              onClick={() => setCategory(name as CharacterCategory)}
            >
              {name}
            </button>
          ))}
        </div>
        <section role="tabpanel" aria-label={category}>
          <div className="character-picker mb-[22px] grid grid-cols-3 gap-[6px]">
            {CHARACTER_CATEGORIES[category].map((kind) => (
              <label className={`
                    character-option relative cursor-pointer rounded-[12px] border-[1.5px]
                    border-solid border-[transparent] bg-[#f1f1e9] p-[7px_2px] text-center
                    focus-within:[outline:2px_solid_#698b5b] focus-within:outline-offset-2 [&_.character]:h-[57px]
                    [&_input]:absolute [&_input]:h-[1px] [&_input]:w-[1px]
                    [&_input]:opacity-0 [&_span]:text-[9px] [&_span]:text-[#68745e]
                    [&.selected]:border-[#8a9e6b] [&.selected]:bg-[#eaf0de]
                  ${profile.character === kind ? "selected" : ""}`} key={kind}>
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
        {children}
        {autoSave ? (
          saveError && (
            <p
              className="
                error flex items-start gap-[5px] rounded-[9px] bg-[#f6e9df] p-[11px]
                text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_button]:ml-auto
                [&_button]:bg-transparent [&_button]:p-[0_2px] [&_button]:text-inherit
              "
              role="alert"
            >
              {saveError}
            </p>
          )
        ) : (
          <button
            className="
              primary flex w-full items-center justify-between rounded-[10px] bg-[#d3e8af] p-[13px_14px]
              text-[12px] font-semibold text-[#425335] [&_span]:text-[18px] [&_span]:leading-[1]
              [&_span]:font-normal [&:hover]:bg-[#c7dda1]
            "
            disabled={!profile.name.trim() || !canSave}
            type="submit"
          >
            이 모습으로 함께하기
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </fieldset>
    </form>
  );
}
