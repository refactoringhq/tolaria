export type MobileHaptic = "selection" | "light" | "success" | "warning";

export function emitMobileHaptic(kind: MobileHaptic): Promise<void> {
  return hapticFeedback(kind).then(() => undefined).catch(() => undefined);
}

async function hapticFeedback(kind: MobileHaptic) {
  const Haptics = await import("expo-haptics");
  if (kind === "selection") return Haptics.selectionAsync();
  if (kind === "light")
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  return Haptics.notificationAsync(
    kind === "success"
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning,
  );
}
