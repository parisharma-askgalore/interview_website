import express from "express";
import edgeTTS from "@andresaya/edge-tts";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    const stream = await edgeTTS.ttsStream(
      text,
      "en-US-JennyNeural"
    );

    res.setHeader("Content-Type", "audio/mpeg");

    stream.pipe(res);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "TTS failed",
    });
  }
});

export default router;