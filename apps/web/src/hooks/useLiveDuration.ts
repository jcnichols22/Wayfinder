import { useEffect, useState } from "react";

export function useLiveDuration(startTime: string | null): string {
  const [label, setLabel] = useState("0m");

  useEffect(() => {
    if (!startTime) {
      setLabel("0m");
      return;
    }

    function tick() {
      const start = new Date(startTime as string).getTime();
      const now = Date.now();
      const totalMinutes = Math.max(0, Math.floor((now - start) / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const seconds = Math.floor(((now - start) % 60000) / 1000);
      setLabel(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return label;
}
