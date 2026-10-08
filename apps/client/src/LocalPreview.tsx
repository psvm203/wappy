import { useEffect, useRef, type ReactNode } from "react";
import type { ProfileInput } from "@wappy/api";
import { ProfileForm } from "./ProfileForm";

export function LocalPreview({
  profile,
  controls,
  error,
  onChange,
  onExit,
}: {
  profile: ProfileInput;
  controls: ReactNode;
  error: string;
  onChange: (profile: ProfileInput) => void;
  onExit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      className="onboarding scroll-area local-preview"
      aria-label="서버 없이 체험"
    >
      <p className="eyebrow">서버 없이 체험 중</p>
      <h1 ref={heading} tabIndex={-1}>
        내 화면에
        <br />
        작은 친구 한 명.
      </h1>
      <p className="intro-copy">
        캐릭터가 화면 가장자리를 따라 걸어요.
        <br />
        잡아서 옮기거나 살짝 던져보세요.
      </p>
      <button className="secondary" type="button" onClick={onExit}>
        체험 끝내고 시작하기
      </button>
      {controls}
      <ProfileForm
        initial={profile}
        busy={false}
        onSave={onChange}
        submitLabel="체험 모습 바꾸기"
      />
      <p className="hint">
        체험 모습은 서버에 저장되지 않으며, 체험을 끝내거나 앱을 종료하면
        사라져요. 친구와 연결하려면 같은 서버에서 프로필을 만들어 주세요.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
