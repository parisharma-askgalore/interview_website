import express from "express";
import InterviewSession from "../models/InterviewSession.js";
import Question from "../models/Question.js";
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
    const { name, email, role } = req.body;

    const session = await InterviewSession.create({
      sessionId: crypto.randomUUID(),

      candidate: {
        name,
        email,
        role
      }
    });

    res.json(session);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
});

router.post(
  "/:sessionId/generate-question",

  async (req, res) => {

    try {

      const session =
        await InterviewSession.findOne({

          sessionId:
            req.params.sessionId
        });

      const role =
        session.candidate.role;

      const previousAnswers =
        session.answers
          .map(

            answer =>

              `
              Question:
              ${answer.questionText}

              Answer:
              ${answer.transcript}
              `
          )
          .join("\n");

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
              You are an interviewer.

              Generate ONE moderately hard
              interview question for:

              ${role}
              
              It needs to be a one line question that a candidate can read within 5 seconds.
              Build upon previous answers.

              Also generate ideal answer.

              Return JSON:

              {
                "question": "...",
                "expectedAnswer": "..."
              }
              `
            },

            {
              role: "user",

              content:
                previousAnswers
            }
          ]
        });

      const content =
  completion.choices[0]
    .message.content;

const responseText =

  typeof content === "string"

    ? content

    : content
        ?.map(
          item => item.text || ""
        )
        .join(" ")

    || "";

console.log("RAW QUESTION:");
console.log(responseText);

const cleaned =

  responseText

    .replace(/```json\s*/gi, "")

    .replace(/```\s*/g, "")

    .trim();

console.log("CLEANED:");
console.log(cleaned);

let parsed;

try {

  parsed =
    JSON.parse(cleaned);

} catch (error) {

  console.log(error);

  parsed = {

    question:
      "Explain a difficult technical challenge you solved.",

    expectedAnswer:
      "Structured technical explanation with problem-solving approach."
  };
}

res.json(parsed);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        question:
          "Explain a challenging technical problem you solved.",

        expectedAnswer:
          "Structured technical explanation."
      });

    }
  }
);

router.post(
  "/:sessionId/violation",

  async (req, res) => {

    try {

      const {
        type
      } = req.body;

      const session =
        await InterviewSession.findOne({

          sessionId:
            req.params.sessionId
        });
      

      session.violations.push({

        type,
        timestamp: new Date()
      });

      if (
        session.violations.length >= 2
      ) {

        session.interviewTerminated =
          true;

        session.terminationReason =
          "Cheating detected";

        session.status =
        "terminated";
      }

      await session.save();

      res.json({

        terminated:
          session.interviewTerminated
      });

    } catch (error) {

      res.status(500).json({
        message: error.message
      });

    }
  }
);

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

      const session =
        await InterviewSession.findOne({

          sessionId:
            req.params.sessionId
        });

      if (
        session.interviewTerminated
      ) {

        return res.status(403).json({

          message:
            "Interview terminated"
        });
      }

      const {
        questionIndex,
        questionText,
        transcript
      } = req.body;

      let expectedAnswer = "";

        if (
          Number(questionIndex) < 3
        ) {

          const originalQuestion =
            await Question.findOne({

              questionIndex:
                Number(questionIndex) + 1

            });

          expectedAnswer =
            originalQuestion?.answer || "";

        } else {

          expectedAnswer =
            req.body.expectedAnswer || "";
        }

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
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
console.log("CLEANED:");
console.log(cleaned);
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
        `app/reports/${session.sessionId}.pdf`;

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