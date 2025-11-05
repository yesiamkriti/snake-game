import express from "express";
import Score from "../models/Score.js";

const router = express.Router();

// Get top 10 scores
router.get("/", async (req, res) => {
  try {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to load scores" });
  }
});

// Save new score and clean up old ones
router.post("/", async (req, res) => {
  try {
    const { name, score } = req.body;

    if (!name || typeof score !== "number") {
      return res.status(400).json({ error: "Invalid name or score" });
    }

    // Save the new score
    const newScore = new Score({ name, score });
    await newScore.save();

    // Keep only top 10 highest scores
    const topScores = await Score.find().sort({ score: -1 }).limit(10);
    const topIds = topScores.map((s) => s._id);

    // Delete all others not in top 10
    await Score.deleteMany({ _id: { $nin: topIds } });

    res.json({ message: "Score saved and leaderboard cleaned!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save score" });
  }
});

export default router;
