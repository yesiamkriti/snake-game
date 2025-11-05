import React, { useEffect, useState } from "react";

export default function Leaderboard() {
  const [scores, setScores] = useState([]);

  const loadScores = () => {
    fetch("http://localhost:5000/api/scores")
      .then(res => res.json())
      .then(data => setScores(data));
  };

  useEffect(() => {
    loadScores();
    window.addEventListener("scoreSaved", loadScores);
    return () => window.removeEventListener("scoreSaved", loadScores);
  }, []);

  return (
    <div className="mt-6 text-center">
      <h3 className="text-2xl mb-2 font-semibold">🏆 Leaderboard</h3>
      <ul>
        {scores.map((s, i) => (
          <li key={i}>
            {i + 1}. {s.name} - {s.score}
          </li>
        ))}
      </ul>
    </div>
  );
}
