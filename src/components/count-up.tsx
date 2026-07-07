import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export function CountUp({ to, duration = 1.1, format }: { to: number; duration?: number; format?: (n: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => setV(n),
    });
    return () => controls.stop();
  }, [to, duration]);
  return <>{format ? format(v) : Math.round(v).toLocaleString()}</>;
}
