import mongoose from "mongoose";

const InterviewSessionSchema = new mongoose.Schema(
  {
    sessionId: String,

    candidate: {
      name: String,
      email: String,
      position: String
    },

    status: {
      type: String,
      default: "in_progress"
    },

    answers: [
      {
        questionNumber: Number,

        questionText: String,

        transcript: String,

        expectedAnswer: String,

        score: Number,

        evaluation: String,

        evaluationStatus: {
          type: String,
          default: "pending"
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

const InterviewSession = mongoose.model(
  "InterviewSession",
  InterviewSessionSchema
);

export default InterviewSession;