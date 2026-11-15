'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

/**
 * Campo de estrellas en canvas con profundidad. `warp` acelera las estrellas
 * hasta convertirlas en estelas (transición al entrar al panel).
 * Con movimiento reducido se dibuja una sola vez, estático.
 */
export function Starfield({ warp, transparent = false }: { warp: boolean; transparent?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef(warp);

  useEffect(() => {
    warpRef.current = warp;
  }, [warp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COUNT = transparent ? 260 : 520;
    const DEPTH = 1000;
    let w = 0;
    let h = 0;
    let raf = 0;
    let speed = 0.6;

    const spawn = (z = Math.random() * DEPTH): Star => ({
      x: (Math.random() * 2 - 1) * 1600,
      y: (Math.random() * 2 - 1) * 1000,
      z,
      pz: z,
    });
    const stars: Star[] = Array.from({ length: COUNT }, () => spawn());

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const target = warpRef.current ? 38 : 0.6;
      speed += (target - speed) * 0.06;
      if (transparent) {
        ctx.clearRect(0, 0, w, h);
      } else {
        ctx.fillStyle = warpRef.current ? 'rgba(2, 6, 23, 0.35)' : '#020617';
        ctx.fillRect(0, 0, w, h);
      }

      const cx = w / 2;
      const cy = h * 0.42;
      const fov = Math.min(w, h) * 0.9;

      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed;
        if (s.z < 1) {
          Object.assign(s, spawn(DEPTH));
          continue;
        }
        const k = fov / s.z;
        const x = cx + s.x * k * 0.5;
        const y = cy + s.y * k * 0.5;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) {
          Object.assign(s, spawn(DEPTH));
          continue;
        }
        const near = 1 - s.z / DEPTH;
        const alpha = Math.min(1, 0.15 + near * 1.1);
        const size = 0.4 + near * 1.6;

        if (speed > 2) {
          const pk = fov / s.pz;
          ctx.strokeStyle = `rgba(165, 243, 252, ${alpha})`;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(cx + s.x * pk * 0.5, cy + s.y * pk * 0.5);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else {
          ctx.fillStyle = near > 0.85 ? `rgba(165, 243, 252, ${alpha})` : `rgba(226, 232, 240, ${alpha})`;
          ctx.fillRect(x, y, size, size);
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const onResize = () => {
      resize();
      if (reduced) draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [transparent]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}

export default Starfield;
