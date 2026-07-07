import { useEffect, useState } from "react";

export function useDetailLoading(delay = 400) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return loading;
}
