import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import interviewRoutes from "./routes/interviewRoutes.js";
import transporter from "./services/mailService.js";

import connectDB from "./config/db.js";

dotenv.config();

connectDB();

const app = express();

// Enable CORS and JSON body parsing before mounting routes
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Server Running");
});

app.use("/api/interview", interviewRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  // Verify mail transporter at startup to catch config/auth issues early
  if (transporter && transporter.verify) {
    transporter.verify().then(() => {
      console.log("Mail transporter verified");
    }).catch((err) => {
      console.error("Mail transporter verification failed:", err && err.message ? err.message : err);
    });
  }
});