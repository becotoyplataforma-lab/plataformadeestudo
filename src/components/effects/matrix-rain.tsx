"use client";

import { useEffect, useRef } from "react";

interface MatrixRainProps {
  speed?: number;
  density?: number;
  color?: string;
  headColor?: string;
  fontSize?: number;
}

const WORD_BANK = [
  "IA",
  "ESTUDO",
  "PROVA",
  "FOCO",
  "PLANO",
  "TAREFA",
  "METODO",
  "RANKING",
  "QUESTAO",
  "MATERIA",
  "APROVA",
  "PENSAR",
  "SIMULADO",
  "RESULT",
  "BEM",
  "ALVO",
  "VITORIA",
  "AULA",
  "PRAZO",
  "EXERC",
  "ORDEM",
  "PASSO",
  "TUDO",
  "FUTURO",
  "MINTA",
  "PODER",
  "PRAIA",
  "PONTOS",
  "REVISAR",
  "ESTUDE",
  "DISCIP",
  "RITMO",
  "CRESC",
];

export function MatrixRain({
  speed = 0.80,
  density = 1.35,
  color = "#6ee7b7",
  headColor = "#f8f3a8",
  fontSize = 16,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let columns: { x: number; y: number; word: string; speed: number }[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `700 ${fontSize}px "Share Tech Mono", "Courier New", monospace`;

      const columnWidth = Math.max(fontSize * density, fontSize + 8);
      const columnsCount = Math.ceil(width / columnWidth) + 1;
      columns = Array.from({ length: columnsCount }, (_, index) => ({
        x: index * columnWidth,
        y: Math.random() * -height,
        word: WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)],
        speed: speed * (0.8 + Math.random() * 0.7),
      }));
    };

    const draw = () => {
      ctx.fillStyle = "rgba(4, 8, 12, 0.10)";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const chars = col.word.split("");

        // Trail behind the word — alterna: uma coluna sim, outra não
        if (i % 2 === 0) {
          for (let t = 1; t <= 3; t++) {
            const trailY = col.y - t * fontSize;
            if (trailY < 0) continue;
            const alpha = Math.max(0.08, 0.55 - t * 0.12);
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(110, 231, 183, ${alpha})`;
            const trailChar = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(trailChar, col.x, trailY);
          }
        }

        for (let j = 0; j < chars.length; j++) {
          const y = col.y + j * fontSize;
          const isHead = j === chars.length - 1;

          ctx.shadowBlur = isHead ? 12 : 0;
          ctx.shadowColor = isHead ? "rgba(248, 243, 168, 0.85)" : "rgba(110, 231, 183, 0.30)";
          ctx.fillStyle = isHead ? headColor : color;
          ctx.fillText(chars[j], col.x, y);
        }

        col.y += col.speed;

        if (col.y > height + chars.length * fontSize + 30) {
          col.y = -Math.random() * 180 - 20;
          col.word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
          col.speed = speed * (0.8 + Math.random() * 0.7);
        }
      }

      ctx.shadowBlur = 0;
      rafId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [speed, density, color, headColor, fontSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-90"
      style={{ background: "transparent" }}
    />
  );
}
