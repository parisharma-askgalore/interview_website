import mongoose from "mongoose";

const InterviewSessionSchema = new mongoose.Schema(
  {
    sessionId: String,

    candidate: {
      name: String,
      email: String,
      position: String,
      role: String
    },

    status: {
      type: String,
      default: "in_progress"
    },

    answers: [
      {
        aiGenerated: Boolean,
        
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
    ],

    violations: [
      {
        type: String,
        timestamp: Date
      }
    ],

    interviewTerminated: {
      type: Boolean,
      default: false
    },

    terminationReason: String,

    role: String
      },
  {
    timestamps: true
  },
);

const InterviewSession = mongoose.model(
  "InterviewSession",
  InterviewSessionSchema
);

export default InterviewSession;