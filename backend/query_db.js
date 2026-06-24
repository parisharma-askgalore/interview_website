import mongoose from "mongoose";

const mongoURI = "mongodb://127.0.0.1:27017/interview_platform";

const CandidateSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
});

const AnswerSchema = new mongoose.Schema({
  questionNumber: Number,
  questionText: String,
  transcript: String,
  expectedAnswer: String,
  score: mongoose.Schema.Types.Mixed,
  evaluation: String,
  evaluationStatus: String,
});

const SessionSchema = new mongoose.Schema({
  sessionId: String,
  candidate: CandidateSchema,
  status: String,
  answers: [AnswerSchema],
  createdAt: Date,
});

async function main() {
  try {
    await mongoose.connect(mongoURI);
    const Session = mongoose.model("InterviewSession", SessionSchema);
    const sessions = await Session.find().sort({ createdAt: -1 }).limit(5);
    
    console.log("Listing latest 5 sessions in MongoDB:");
    sessions.forEach(s => {
      console.log(`- SessionID: ${s.sessionId}`);
      console.log(`  Candidate: ${s.candidate?.name} (${s.candidate?.role})`);
      console.log(`  Status: ${s.status}`);
      console.log(`  Answers Count: ${s.answers?.length || 0}`);
    });
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
