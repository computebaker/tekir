"use client";

import React, { useMemo, useState, useCallback } from "react";
import Image from "next/image";

type FlyingCatsProps = {
  show?: boolean;
  count?: number; // number of cats to render
};

type CatSpec = {
  id: string;
  src: string;
  leftPct: number;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  drift: number; // px to drift horizontally while falling
};

const CAT_IMAGES = ["/cats/1.png", "/cats/2.png", "/cats/3.png"] as const;

export default function FlyingCats({ show = false, count = 12 }: FlyingCatsProps) {
  const [doneCount, setDoneCount] = useState(0);
  const [visible, setVisible] = useState(true);
  // Reset state if show or count changes
  React.useEffect(() => {
    setDoneCount(0);
    setVisible(true);
  }, [show, count]);

  const cats = useMemo<CatSpec[]>(() => {
    if (!show) return [];
    const items: CatSpec[] = [];
    for (let i = 0; i < count; i++) {
      items.push({
        id: `cat-${i}-${Math.random().toString(36).slice(2, 8)}`,
        src: CAT_IMAGES[Math.floor(Math.random() * CAT_IMAGES.length)],
        leftPct: Math.floor(Math.random() * 92), // 0 - 92% from left
        size: Math.floor(40 + Math.random() * 60), // 40 - 100 px
        duration: 4 + Math.random() * 2, // 4s - 6s
        delay: i % 3 === 0 ? 0 : Math.random() * 2, // 0 - 2s
        rotation: -20 + Math.random() * 40, // -20deg to 20deg
        drift: -40 + Math.random() * 80, // -40px to +40px horizontal drift
      });
    }
    return items;
  }, [show, count]);

  const handleCatEnd = useCallback(() => {
    setDoneCount((prev) => {
      const next = prev + 1;
      if (next >= count) {
        setTimeout(() => setVisible(false), 200); // small delay for smoothness
      }
      return next;
    });
  }, [count]);

  if (!show || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden="true"
    >
      {cats.map((c) => {
        const style: React.CSSProperties & { [key: string]: string | number } = {
          left: `${c.leftPct}%`,
          top: '-12%',
        };
        style["--duration"] = `${c.duration}s`;
        style["--delay"] = `${c.delay}s`;
        style["--rotate"] = `${c.rotation}deg`;
        style["--drift"] = `${c.drift}px`;
        return (
          <div
            key={c.id}
            className="cat"
            style={style}
            onAnimationEnd={handleCatEnd}
          >
            <img
              src={c.src}
              alt=""
              width={c.size}
              height={c.size}
              className="block opacity-90 select-none"
              draggable={false}
              decoding="async"
            />
          </div>
        );
      })}

      <style jsx>{`
        .cat {
          position: absolute;
          will-change: transform;
          transform: rotate(var(--rotate));
          animation: fall-down var(--duration) linear var(--delay) 1;
        }

        @keyframes fall-down {
          0% {
            transform: translateY(0) translateX(0) rotate(var(--rotate));
            opacity: 0.9;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) translateX(var(--drift)) rotate(var(--rotate));
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
