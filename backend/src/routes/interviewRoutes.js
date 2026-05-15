import express from "express";
import InterviewSession from "../models/InterviewSession.js";
import Question from "../models/Question.js";
import fs from "fs";
import crypto from "crypto";

import azureClient from
"../services/azureOpenAIService.js";

import {
  sdk,
  speechConfig
} from "../services/azureSpeechService.js";

import generateInterviewPDF
from "../services/pdfService.js";

import transporter
from "../services/mailService.js";

const router = express.Router();

router.post("/start", async (req, res) => {
  try {
    const { name, email, position } = req.body;

    const session = await InterviewSession.create({
      sessionId: crypto.randomUUID(),

      candidate: {
        name,
        email,
        position
      }
    });

    res.json(session);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
});

router.get("/questions", async (req, res) => {

  try {

    const questions = await Question.find()
      .sort({ questionIndex: 1 });

    res.json(questions);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
});

router.post(
  "/:sessionId/answer",

  async (req, res) => {

    try {

      const {
        questionIndex,
        questionText,
        transcript
      } = req.body;

      const originalQuestion =
        await Question.findOne({

          questionIndex:
            Number(questionIndex) + 1

        });

      const expectedAnswer =
        originalQuestion?.answer || "";

      const session =
        await InterviewSession.findOne({

          sessionId:
            req.params.sessionId

        });

      session.answers.push({

        questionNumber:
          Number(questionIndex) + 1,

        questionText,

        transcript,

        expectedAnswer,

        score: null,

        evaluation: "Processing...",

        evaluationStatus: "pending"

      });

      await session.save();

      res.json({
        success: true
      });

      (async () => {

  try {

    const completion =
      await azureClient.chat.completions.create({

        model:
          process.env
            .AZURE_OPENAI_DEPLOYMENT,

        messages: [

          {
            role: "system",

            content:
            `
              You are an AI interview evaluator.

              Evaluate the candidate answer
              against the expected answer.

              IMPORTANT:
              Return ONLY valid JSON.

              Format:

              {
                "score": 8,
                "feedback": "Strong answer..."
              }
            `
          },

          {
            role: "user",

            content:
            `
            Question:
            ${questionText}

            Expected Answer:
            ${expectedAnswer}

            Candidate Answer:
            ${transcript}
            `
          }

        ],

        temperature: 0.3,

        max_tokens: 120

      });

    const content =
  completion.choices[0]
    .message.content;

const responseText =
  typeof content === "string"

    ? content

    : content
        ?.map(item => item.text || "")
        .join(" ") || "";

console.log("RAW AI RESPONSE:");
console.log(responseText);

const cleaned =
  responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

const parsed =
  JSON.parse(cleaned);

const score =
  Number(parsed.score);

const evaluation =
  parsed.feedback;

console.log("UPDATING ANSWER");

console.log({
  sessionId: req.params.sessionId,
  questionNumber: Number(questionIndex) + 1,
  score,
  evaluation
});

const freshSession =
  await InterviewSession.findOne({

    sessionId:
      req.params.sessionId
  });

const answerIndex =
  freshSession.answers.findIndex(

    answer =>

      answer.questionNumber ===
      Number(questionIndex) + 1
  );

console.log("ANSWER INDEX:");
console.log(answerIndex);

await InterviewSession.updateOne(

  {
    sessionId:
      req.params.sessionId
  },

  {

    $set: {

      [`answers.${answerIndex}.score`]:
        score,

      [`answers.${answerIndex}.evaluation`]:
        evaluation,

      [`answers.${answerIndex}.evaluationStatus`]:
        "completed"
    }
  }
);

  } catch (err) {

    console.log(err);
    await InterviewSession.updateOne(

    {
      sessionId:
        req.params.sessionId,

      "answers.questionNumber":
        Number(questionIndex) + 1
    },

    {

      $set: {

        "answers.$.evaluation":
          "Evaluation failed",

        "answers.$.evaluationStatus":
          "failed"
      }
    }
  );

  }

})();

      // Background evaluation here

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: error.message
      });

    }
  }
);

router.post(
  "/:sessionId/complete",

  async (req, res) => {

    try {

      const session =
        await InterviewSession.findOne({

          sessionId:
            req.params.sessionId

        });

      const pdfPath =
        `src/reports/${session.sessionId}.pdf`;

      let pending = true;

while (pending) {

  const updatedSession =
    await InterviewSession.findOne({

      sessionId:
        req.params.sessionId

    });

  pending =
    updatedSession.answers.some(

      answer =>
              !(
        answer.evaluationStatus ===
          "completed"

        ||

        answer.evaluationStatus ===
          "failed"
      )
    );

  if (pending) {

    await new Promise(
      resolve =>
        setTimeout(resolve, 2000)
    );

  }
}

      const finalSession =
  await InterviewSession.findOne({

    sessionId:
      req.params.sessionId

  });

      await generateInterviewPDF(
        finalSession,
        pdfPath
      );

      await transporter.sendMail({

        from:
          process.env.HR_EMAIL,

        to:
          process.env.HR_EMAIL,

        subject:
          `Interview Report - ${finalSession.candidate.name}`,

        text:
          `
          Interview completed.

          Candidate:
          ${finalSession.candidate.name}
          `,

        attachments: [
          {
            filename:
              "interview-report.pdf",

            path:
              pdfPath
          }
        ]
      });

      res.json({
        success: true
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: error.message
      });

    }
  }
);

export default router;