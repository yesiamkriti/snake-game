import React, { useEffect, useRef, useState } from "react";

export default function Game() {
  const canvasRef = useRef(null);
  const [snake, setSnake] = useState([[8, 8]]);
  const [food, setFood] = useState([
    Math.floor(Math.random() * 20),
    Math.floor(Math.random() * 20),
  ]);
  const [dir, setDir] = useState("RIGHT");
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const hasSavedRef = useRef(false); // 🧠 this ref prevents duplicates instantly

  const box = 20;
  const canvasSize = 400;

  // handle key input
  const handleKey = (e) => {
    if (e.key === "ArrowUp" && dir !== "DOWN") setDir("UP");
    else if (e.key === "ArrowDown" && dir !== "UP") setDir("DOWN");
    else if (e.key === "ArrowLeft" && dir !== "RIGHT") setDir("LEFT");
    else if (e.key === "ArrowRight" && dir !== "LEFT") setDir("RIGHT");
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    const interval = setInterval(() => {
      if (!gameOver) moveSnake();
    }, 150);
    return () => {
      clearInterval(interval);
      document.removeEventListener("keydown", handleKey);
    };
  });

  const moveSnake = () => {
    let newSnake = [...snake];
    let head = [...newSnake[newSnake.length - 1]];

    switch (dir) {
      case "UP":
        head[1] -= 1;
        break;
      case "DOWN":
        head[1] += 1;
        break;
      case "LEFT":
        head[0] -= 1;
        break;
      case "RIGHT":
        head[0] += 1;
        break;
      default:
        break;
    }

    // Wall collision
    if (
      head[0] < 0 ||
      head[1] < 0 ||
      head[0] * box >= canvasSize ||
      head[1] * box >= canvasSize
    ) {
      endGame();
      return;
    }

    // Self collision
    for (let part of newSnake) {
      if (part[0] === head[0] && part[1] === head[1]) {
        endGame();
        return;
      }
    }

    newSnake.push(head);

    // Eat food
    if (head[0] === food[0] && head[1] === food[1]) {
      setScore(score + 1);
      setFood([
        Math.floor(Math.random() * 20),
        Math.floor(Math.random() * 20),
      ]);
    } else {
      newSnake.shift();
    }

    setSnake(newSnake);
  };

  const endGame = async () => {
    // 🧱 prevent multiple triggers instantly
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    setGameOver(true);
    setHasSaved(true);

    const name = prompt("Game over! Enter your name:");
    if (name) {
      try {
        await fetch("http://localhost:5000/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, score }),
        });
        window.dispatchEvent(new Event("scoreSaved"));
      } catch (err) {
        console.error("Error saving score:", err);
      }
    }
  };

  // draw everything
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f0fff4";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.fillStyle = "#2b6cb0";
    snake.forEach(([x, y]) => {
      ctx.fillRect(x * box, y * box, box - 1, box - 1);
    });

    ctx.fillStyle = "#e53e3e";
    ctx.fillRect(food[0] * box, food[1] * box, box - 1, box - 1);

    if (gameOver) {
      ctx.fillStyle = "black";
      ctx.font = "24px Arial";
      ctx.fillText("Game Over!", 120, 200);
    }
  }, [snake, food, gameOver]);

  const restartGame = () => {
    setSnake([[8, 8]]);
    setFood([
      Math.floor(Math.random() * 20),
      Math.floor(Math.random() * 20),
    ]);
    setDir("RIGHT");
    setScore(0);
    setGameOver(false);
    setHasSaved(false);
    hasSavedRef.current = false; // reset instant flag
  };

  // keyboard restart
  useEffect(() => {
    const handleRestart = (e) => {
      if (e.key === "r" || e.key === "R") restartGame();
    };
    window.addEventListener("keydown", handleRestart);
    return () => window.removeEventListener("keydown", handleRestart);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl mb-2">Score: {score}</h2>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ border: "3px solid black", backgroundColor: "white" }}
      />
      {gameOver && (
        <div className="flex flex-col items-center mt-3">
          <p className="text-red-600 mb-2">Game Over!</p>
          <button
            onClick={restartGame}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Restart
          </button>
        </div>
      )}
    </div>
  );
}
