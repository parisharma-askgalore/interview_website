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
import fs from "fs";

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

      const previousAnswers =

        session.answers

          .map(

            answer =>

            `
            Question:
            ${answer.questionText}

            Candidate Answer:
            ${answer.transcript}
            `
          )

          .join("\n");

      const followUpCount =

        session.answers.filter(

          answer =>
            answer.isFollowUp
        ).length;

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
              You are an adaptive AI interviewer.

              Your job:

              1. Analyze the latest answer
              2. Decide whether:
                 - follow-up needed
                 - move to next topic

              RULES:

              Ask follow-up IF:
              - answer vague
              - lacks technical depth
              - incomplete explanation
              - weak justification
              - short answer

              Move ahead IF:
              - technically strong
              - detailed
              - clear reasoning
              - sufficient depth

              Role:
              ${session.candidate.role}

              Difficulty:
              Moderately Hard

              Maximum follow-up count: 2

              Follow-ups used so far: ${followUpCount}

              If already reached maximum follow-ups,
              you MUST move to a new topic.

              It needs to be a one line question that a candidate can read within 5 seconds.

              Return STRICT JSON:

              {
                "type": "followup" OR "new",
                "question": "...",
                "expectedAnswer": "...",
                "reason": "..."
              }

              NO markdown.
              NO codeblocks.
              `
            },

            {

              role: "user",

              content:
              `
              Previous Interview:

              ${previousAnswers}
              `
            }
          ],

          temperature: 0.7,

          max_tokens: 500
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

          type: "new",

          question:
            "Explain a difficult technical challenge you solved.",

          expectedAnswer:
            "Structured technical explanation with problem-solving approach.",

          reason:
            "Fallback question due to parse error."
        };
      }

      console.log(
        "FOLLOWUP DECISION:"
      );

      console.log(parsed);

      res.json(parsed);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        type: "new",
        question:
          "Explain a challenging technical problem you solved.",

        expectedAnswer:
          "Structured technical explanation.",

        reason: "Fallback due to server error."
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

      // Atomic $push — avoids schema strict-mode conflicts with session.save().
      // matchedCount tells us if the session exists without a separate fetch.
      const pushResult = await InterviewSession.updateOne(
        { sessionId: req.params.sessionId },
        { $push: { violations: { type, timestamp: new Date() } } }
      );

      if (pushResult.matchedCount === 0) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Re-fetch so violation counts are accurate
      const refreshed = await InterviewSession.findOne({ sessionId: req.params.sessionId });

      const fullscreenCount = (refreshed.violations || []).filter(v => v.type === 'fullscreen_exit').length;
      const tabSwitchCount  = (refreshed.violations || []).filter(v => v.type === 'tab_switch').length;

      // Termination rules:
      // - any tab_switch immediately terminates the interview
      // - two fullscreen_exit violations terminate the interview
      let terminated = refreshed.interviewTerminated || false;
      let terminationReason = refreshed.terminationReason || '';

      if (type === 'tab_switch') {
        terminated = true;
        terminationReason = 'Tab switch detected';
      } else if (type === 'fullscreen_exit' && fullscreenCount >= 2) {
        terminated = true;
        terminationReason = 'Repeated fullscreen exits';
      }

      if (terminated) {
        await InterviewSession.updateOne(
          { sessionId: req.params.sessionId },
          { $set: { interviewTerminated: true, status: 'terminated', terminationReason } }
        );
      }

      // Re-fetch final state (needed for PDF generation below)
      const terminatedSession = await InterviewSession.findOne({ sessionId: req.params.sessionId });

      console.log(`[VIOLATION] session=${req.params.sessionId} type=${type} fullscreenCount=${fullscreenCount} tabSwitchCount=${tabSwitchCount} terminated=${terminated}`);

        // If the session was terminated by this violation, generate PDF report and send email to HR asynchronously.
        if (terminated) {
          (async () => {
            try {
              // ── Compute analytics so the PDF has scores ──────────────
              const overallScores = terminatedSession.answers.map(a => a.score?.overall || 0);
              const averageScore = overallScores.length
                ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
                : 0;

              let recommendation = "Reject";
              if (averageScore >= 8) recommendation = "Strong Hire";
              else if (averageScore >= 6) recommendation = "Consider";

              const interviewDuration = Math.floor(
                (new Date() - new Date(terminatedSession.startedAt || terminatedSession.createdAt || Date.now())) / 1000
              );

              const analytics = {
                averageScore,
                recommendation,
                strengths: ["Technical Understanding", "Problem Solving"],
                weaknesses: ["Communication Clarity"],
              };

              // Update analytics + duration atomically
              await InterviewSession.updateOne(
                { sessionId: req.params.sessionId },
                { $set: { analytics, interviewDuration } }
              );

              // Re-fetch with analytics for PDF generation
              const pdfSession = await InterviewSession.findOne({ sessionId: req.params.sessionId });

              // ── Generate PDF ─────────────────────────────────────────
              // Ensure reports directory exists
              fs.mkdirSync('src/reports', { recursive: true });

              const pdfPath = `src/reports/${pdfSession.sessionId}.pdf`;

              console.log(`[VIOLATION TERMINATION] Generating PDF for session=${pdfSession.sessionId}`);
              await generateInterviewPDF(pdfSession, pdfPath);
              console.log(`[VIOLATION TERMINATION] PDF generated at ${pdfPath}`);

              // ── Send email with PDF attached ──────────────────────────
              const subject = `Interview Terminated (Violation) - ${pdfSession.candidate?.name || pdfSession.sessionId}`;
              const text = [
                `Interview session ${pdfSession.sessionId} was force-terminated due to a proctoring violation.`,
                ``,
                `Candidate : ${pdfSession.candidate?.name || 'UNKNOWN'}`,
                `Email     : ${pdfSession.candidate?.email || 'N/A'}`,
                `Role      : ${pdfSession.candidate?.role  || 'N/A'}`,
                ``,
                `Reason          : ${pdfSession.terminationReason || 'violation'}`,
                `Fullscreen exits: ${fullscreenCount}`,
                `Tab switches    : ${tabSwitchCount}`,
                `Timestamp       : ${new Date().toISOString()}`,
                ``,
                `The full interview report (answers completed before termination) is attached.`,
              ].join('\n');

              const mailOptions = {
                from: process.env.HR_EMAIL,
                to: process.env.HR_EMAIL,
                subject,
                text,
                attachments: [
                  {
                    filename: `interview-report-${pdfSession.sessionId}.pdf`,
                    path: pdfPath,
                  },
                ],
              };

              console.log('[VIOLATION TERMINATION] Sending termination email', {
                session: pdfSession.sessionId,
                to: process.env.HR_EMAIL ? 'configured' : 'MISSING',
              });

              const info = await transporter.sendMail(mailOptions);
              console.log(`[VIOLATION TERMINATION] Email sent for session=${pdfSession.sessionId}`, {
                messageId: info && info.messageId,
              });

              // Delete the PDF from disk now that it has been emailed
              try {
                fs.unlinkSync(pdfPath);
                console.log(`[VIOLATION TERMINATION] PDF deleted: ${pdfPath}`);
              } catch (unlinkErr) {
                console.warn(`[VIOLATION TERMINATION] Could not delete PDF: ${unlinkErr.message}`);
              }
            } catch (mailErr) {
              console.error(
                '[VIOLATION TERMINATION] Error generating PDF / sending email:',
                mailErr && mailErr.message ? mailErr.message : mailErr,
                mailErr && mailErr.stack ? mailErr.stack : 'no-stack'
              );
            }
          })();
        }

        res.json({ terminated, counts: { fullscreen: fullscreenCount, tabSwitch: tabSwitchCount } });

    } catch (error) {

      console.error("Violation endpoint error:", error);

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

      const timeTaken = req.body.timeTaken;

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

        timeTaken,

        isFollowUp:
          req.body.isFollowUp || false,

        parentQuestion:
          req.body.parentQuestion || null,

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
You are an expert AI technical interviewer.

Evaluate the candidate answer.

You MUST score across:

1. Technical Knowledge
2. Communication
3. Confidence
4. Problem Solving
5. Overall

Scoring Rules:

0-3: Poor
4-6: Average
7-8: Good
9-10: Excellent

Return STRICT JSON ONLY:

{
  "technical": number,
  "communication": number,
  "confidence": number,
  "problemSolving": number,
  "overall": number,
  "evaluation": "detailed evaluation"
}

NO markdown.
NO code blocks.
NO extra text.
            `
          },

          {
            role: "user",

            content:
            `
            Role:
            ${session.candidate.role}

            Difficulty:
            Moderately Hard

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

        max_tokens: 300

      });

    const responseText =
      completion.choices[0]
        .message.content;

    console.log(
      "RAW AI RESPONSE:"
    );

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

        technical: 0,

        communication: 0,

        confidence: 0,

        problemSolving: 0,

        overall: 0,

        evaluation:
          "Evaluation failed."
      };
    }

    console.log("UPDATING ANSWER");

    console.log({
      sessionId: req.params.sessionId,
      questionNumber: Number(questionIndex) + 1,
      parsed
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

          [`answers.${answerIndex}.score`]: {
            technical: parsed.technical,
            communication: parsed.communication,
            confidence: parsed.confidence,
            problemSolving: parsed.problemSolving,
            overall: parsed.overall
          },

          [`answers.${answerIndex}.evaluation`]:
            parsed.evaluation,

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

// Wait for background evaluations but with a maximum timeout to avoid infinite loops
const waitStart = Date.now();
const MAX_WAIT_MS = 60 * 1000; // 60s
while (pending && Date.now() - waitStart < MAX_WAIT_MS) {
  const updatedSession = await InterviewSession.findOne({
    sessionId: req.params.sessionId,
  });

  pending = updatedSession.answers.some(
    (answer) => !(answer.evaluationStatus === "completed" || answer.evaluationStatus === "failed")
  );

  if (pending) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

if (pending) {
  // Mark any still-pending evaluations as failed to allow completion to proceed
  await InterviewSession.updateOne(
    { sessionId: req.params.sessionId },
    {
      $set: {
        "answers.$[elem].evaluation": "Evaluation timed out",
        "answers.$[elem].evaluationStatus": "failed",
      },
    },
    { arrayFilters: [{ "elem.evaluationStatus": { $nin: ["completed", "failed"] } }], multi: true }
  );
}

      const finalSession =
  await InterviewSession.findOne({

    sessionId:
      req.params.sessionId

  });

      finalSession.interviewDuration =
        Math.floor(
          (new Date() - new Date(finalSession.startedAt)) / 1000
        );

      const overallScores =
        finalSession.answers.map(
          answer => answer.score?.overall || 0
        );

      const averageScore =
        overallScores.length
          ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
          : 0;

      let recommendation = "Reject";

      if (averageScore >= 8) {
        recommendation = "Strong Hire";
      } else if (averageScore >= 6) {
        recommendation = "Consider";
      }

      finalSession.analytics = {
        averageScore,
        recommendation,
        strengths: [
          "Technical Understanding",
          "Problem Solving"
        ],
        weaknesses: [
          "Communication Clarity"
        ]
      };

      await finalSession.save();

      console.log("Generating PDF for session:", req.params.sessionId);
      console.log("PDF Path:", pdfPath);

      await generateInterviewPDF(
        finalSession,
        pdfPath
      );

      console.log("PDF generated successfully");
      console.log("Attempting to send email to:", process.env.HR_EMAIL);

      try {
        const info = await transporter.sendMail({

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

        console.log("Email sent successfully:", info.response);

        // Delete the PDF from disk now that it has been emailed
        try {
          fs.unlinkSync(pdfPath);
          console.log("PDF deleted:", pdfPath);
        } catch (unlinkErr) {
          console.warn("Could not delete PDF:", unlinkErr.message);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }

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