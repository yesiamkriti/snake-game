import React from "react";
import Game from "./Game";
import Leaderboard from "./Leaderboard";
import './App.css'
function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-100">
      <h1 className="text-3xl font-bold mb-4">🐍 Snake Game</h1>
      <Game />
      <Leaderboard />
    </div>
  );
}

export default App;
