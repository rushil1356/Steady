import { useEffect, useRef, useState } from "react";

const BAR = 76; // height of the sliding bar in px

export default function SwipeToConfirm({ onConfirm }: { onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const maxTravel = () => (trackRef.current?.clientHeight ?? 230) - BAR;

  function lock() {
    if (done) return;
    setDone(true);
    setDragging(false);
    setOffset(maxTravel());
    timer.current = window.setTimeout(onConfirm, 600);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || done) return;
    const up = startY.current - e.clientY;
    setOffset(Math.min(Math.max(up, 0), maxTravel()));
  }

  function onPointerUp() {
    if (!dragging || done) return;
    if (offset >= maxTravel() * 0.75) {
      lock();
    } else {
      setDragging(false);
      setOffset(0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      lock();
    }
  }

  return (
    <div
      ref={trackRef}
      className="relative h-56 w-full overflow-hidden rounded-3xl bg-green/15"
    >
      <p className="absolute inset-x-0 top-6 px-4 text-center text-xl font-bold text-green-dark">
        {done ? "Taken" : "Swipe up when you have taken it"}
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Swipe up when you have taken it. Press Enter to confirm."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-3xl bg-green text-3xl font-bold text-white"
        style={{
          height: BAR,
          transform: `translateY(${-offset}px)`,
          touchAction: "none",
          transition: dragging || reduceMotion ? "none" : "transform 200ms ease-out",
        }}
      >
        {done ? "✓" : "↑"}
      </div>
    </div>
  );
}