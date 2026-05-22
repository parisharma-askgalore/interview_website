import express from "express";
import edgeTTS from "edge-tts";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    const audioBuffer = await edgeTTS.ttsPromise({
      text,
      voice: "en-US-JennyNeural",
    });

    res.setHeader("Content-Type", "audio/mpeg");

    return res.send(audioBuffer);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "TTS failed",
    });
  }
});

export default router;