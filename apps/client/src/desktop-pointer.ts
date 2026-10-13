export async function captureDesktopPointer(
  overCharacter: boolean,
  overChat: boolean,
  windowAtCursor: () => Promise<boolean>,
): Promise<boolean> {
  if (overChat) return true;
  if (!overCharacter) return false;
  // Give the entire underlying app window priority, including its buttons.
  return !(await windowAtCursor());
}
