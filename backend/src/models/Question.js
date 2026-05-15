import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({

  questionIndex: Number,

  question: String,

  answer: String

});

export default mongoose.model(
  "Question",
  QuestionSchema
);