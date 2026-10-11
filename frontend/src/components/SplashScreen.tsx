import { useEffect, useState } from "react";

function Flower({
  x,
  y,
  color,
  delay = 0,
}: {
  x: number;
  y: number;
  color: string;
  delay?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="steady-bloom"
      style={{ animationDelay: `${delay}s` }}
    >
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-13"
          rx="9"
          ry="15"
          fill={color}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r="6" fill="#E8B85C" />
      <circle r="2" fill="#FFF5D8" />
    </g>
  );
}

function FloralVine({ right = false }: { right?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 700"
      preserveAspectRatio="xMidYMid meet"
      className={`absolute top-1/2 h-[75vh] w-[28vw] max-w-[220px] -translate-y-1/2 sm:h-[85vh] sm:w-[24vw] ${
  right ? "right-0 scale-x-[-1]" : "left-0"
}`}
      aria-hidden="true"
    >
      {/* Main growing vine */}
      <path
        d="M0 690 C130 620 30 530 120 440 S55 290 130 200 S80 80 0 10"
        fill="none"
        stroke="#75A98A"
        strokeWidth="3"
        strokeLinecap="round"
        className="steady-vine-grow"
      />

      {/* Branches */}
      <g
        fill="none"
        stroke="#75A98A"
        strokeWidth="2"
        className="steady-leaf-appear"
      >
        <path d="M82 590 Q145 590 165 545" />
        <path d="M105 455 Q40 440 20 395" />
        <path d="M92 310 Q155 300 170 250" />
        <path d="M112 175 Q40 155 25 110" />
      </g>

      {/* Leaves */}
      <g fill="#82B99B" className="steady-leaf-appear">
        <ellipse
          cx="105"
          cy="575"
          rx="13"
          ry="28"
          transform="rotate(45 105 575)"
        />
        <ellipse
          cx="150"
          cy="550"
          rx="12"
          ry="26"
          transform="rotate(55 150 550)"
        />
        <ellipse
          cx="55"
          cy="410"
          rx="13"
          ry="28"
          transform="rotate(-45 55 410)"
        />
        <ellipse
          cx="145"
          cy="275"
          rx="12"
          ry="26"
          transform="rotate(45 145 275)"
        />
        <ellipse
          cx="45"
          cy="120"
          rx="12"
          ry="25"
          transform="rotate(-40 45 120)"
        />
      </g>

      {/* Flowers blooming at different times */}
      <Flower x={165} y={545} color="#F7C7C2" delay={0.8} />
      <Flower x={20} y={395} color="#FFF0CE" delay={1.2} />
      <Flower x={170} y={250} color="#F7C7C2" delay={1.6} />
      <Flower x={25} y={110} color="#FFF0CE" delay={2.0} />
    </svg>
  );
}

export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLeaving(true);
    }, 3300);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#F4FBF6] transition-opacity duration-700 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Soft background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E0F5E8] opacity-70 blur-3xl" />

      {/* Symmetrical animated flowers */}
      <FloralVine />
      <FloralVine right />

      {/* Centered Steady logo */}
      <div className="relative z-10 flex flex-col items-center">
        <img
          src="/steady-logo.png"
          alt="Steady"
          className="steady-logo-enter w-60 max-w-[60vw] object-contain sm:w-80"
        />

        {/* Animated loading bar */}
        <div className="mt-8 h-[5px] w-44 overflow-hidden rounded-full bg-[#D4EADF]">
          <div className="steady-bar-fill h-full w-full origin-left rounded-full bg-gradient-to-r from-[#0F766E] via-[#46C4AC] to-[#9DE4C9]" />
        </div>

        <p className="mt-4 text-sm font-medium tracking-wide text-[#6D9486]">
          Growing care, one day at a time.
        </p>
      </div>

      <style>{`
        .steady-vine-grow {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: steadyVineGrow 2.8s ease-in-out forwards;
        }

        .steady-leaf-appear {
          opacity: 0;
          animation: steadyLeafAppear 1s ease-out 0.7s forwards;
        }

        .steady-bloom {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: steadyFlowerBloom 0.8s cubic-bezier(.2,1.5,.5,1) both;
        }

        .steady-logo-enter {
          animation: steadyLogoEnter 1.2s ease-out both;
        }

        .steady-bar-fill {
          animation: steadyBarFill 3.3s linear forwards;
        }

        @keyframes steadyVineGrow {
          to { stroke-dashoffset: 0; }
        }

        @keyframes steadyLeafAppear {
          to { opacity: 1; }
        }

        @keyframes steadyFlowerBloom {
          from {
            opacity: 0;
            scale: 0.1;
          }
          to {
            opacity: 1;
            scale: 1;
          }
        }

        @keyframes steadyLogoEnter {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes steadyBarFill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .steady-vine-grow,
          .steady-leaf-appear,
          .steady-bloom,
          .steady-logo-enter,
          .steady-bar-fill {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            scale: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}