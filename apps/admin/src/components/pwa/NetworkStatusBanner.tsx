import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";

type NetworkMessage =
  { kind: "offline"; text: string } | { kind: "online"; text: string } | null;

export function NetworkStatusBanner() {
  const [message, setMessage] = useState<NetworkMessage>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const show = (next: Exclude<NetworkMessage, null>, duration?: number) => {
      if (timeout) clearTimeout(timeout);
      setMessage(next);
      if (duration) {
        timeout = setTimeout(() => setMessage(null), duration);
      }
    };

    const onOffline = () =>
      show({
        kind: "offline",
        text: "Sem internet — o trabalho continua salvo neste dispositivo.",
      });

    const onOnline = () =>
      show(
        {
          kind: "online",
          text: "Conexão restaurada.",
        },
        2200,
      );

    if (navigator.onLine === false) onOffline();

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!message) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className={
        "markmap-network-status " +
        (message.kind === "offline" ? "is-offline" : "is-online")
      }
    >
      <AppIcon
        name={message.kind === "offline" ? "notificationsOff" : "sync"}
        size="sm"
      />
      <span>{message.text}</span>
    </aside>
  );
}
