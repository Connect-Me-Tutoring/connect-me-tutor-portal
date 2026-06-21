"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PROGRESS_EVENT = "connectme:navigation-progress";

function runProgressAnimation(
  setVisible: (v: boolean) => void,
  setWidth: (w: number) => void,
) {
  setVisible(true);
  setWidth(12);

  const t1 = window.setTimeout(() => setWidth(55), 120);
  const t2 = window.setTimeout(() => setWidth(82), 320);
  const t3 = window.setTimeout(() => setWidth(100), 520);
  const t4 = window.setTimeout(() => {
    setVisible(false);
    setWidth(0);
  }, 680);

  return () => {
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
    window.clearTimeout(t4);
  };
}

export function startNavigationProgress() {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    return runProgressAnimation(setVisible, setWidth);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onStart = () => runProgressAnimation(setVisible, setWidth);
    window.addEventListener(PROGRESS_EVENT, onStart);
    return () => window.removeEventListener(PROGRESS_EVENT, onStart);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] bg-[#d9ebff]/80"
      aria-hidden
    >
      <div
        className="h-full bg-blue-400 transition-[width] duration-300 ease-out shadow-[0_0_10px_rgba(96,165,250,0.45)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
