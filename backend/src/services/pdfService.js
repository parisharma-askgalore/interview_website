import PDFDocument from "pdfkit";
import fs from "fs";

const generateInterviewPDF = (
  session,
  outputPath
) => {

  return new Promise((resolve) => {

    const doc = new PDFDocument({
      margin: 50
    });

    const stream =
      fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // COLORS
    const primaryColor  = "#2563eb";
    const dangerColor   = "#dc2626";
    const successColor  = "#16a34a";
    const grayColor     = "#6b7280";

    // ── STEP 5: HEADER ────────────────────────────────────────────
    doc
      .rect(0, 0, 700, 90)
      .fill(primaryColor);

    doc
      .fillColor("white")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("Interview Evaluation Report", 50, 30);

    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 65);

    doc.moveDown(4);
    doc.fillColor("black");

    // ── STEP 6: CANDIDATE SUMMARY CARD ───────────────────────────
    doc
      .roundedRect(50, 120, 500, 130, 10)
      .stroke(primaryColor);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("Candidate Summary", 70, 135);

    doc
      .fillColor("black")
      .fontSize(12)
      .font("Helvetica");

    doc.text(`Name: ${session.candidate.name}`, 70, 170);
    doc.text(`Email: ${session.candidate.email}`);
    doc.text(`Role: ${session.candidate.role}`);
    doc.text(`Violations: ${session.violations.length}`);
    doc.text(
      `Interview Duration: ${Math.floor(session.interviewDuration / 60)} min ${session.interviewDuration % 60} sec`
    );

    doc.moveDown(6);

    // ── STEP 7: ANALYTICS SECTION ─────────────────────────────────
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("Final Assessment");

    doc.moveDown(1);

    doc
      .fontSize(13)
      .fillColor("black")
      .font("Helvetica-Bold")
      .text(`Average Score: ${session.analytics?.averageScore?.toFixed(1) ?? "0.0"}/10`);

    doc.moveDown(0.5);

    doc
      .fillColor(
        session.analytics?.recommendation === "Strong Hire"
          ? successColor
          : dangerColor
      )
      .fontSize(16)
      .text(`Recommendation: ${session.analytics?.recommendation ?? "N/A"}`);

    doc.moveDown(1);

    // ── STEP 8: STRENGTHS / WEAKNESSES ───────────────────────────
    doc
      .fillColor(primaryColor)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Strengths");

    doc.moveDown(0.5);

    (session.analytics?.strengths || []).forEach(item => {
      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(`• ${item}`);
    });

    doc.moveDown(1);

    doc
      .fillColor(dangerColor)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Weaknesses");

    doc.moveDown(0.5);

    (session.analytics?.weaknesses || []).forEach(item => {
      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(`• ${item}`);
    });

    doc.moveDown(2);

    // ── VIOLATION LOG ─────────────────────────────────────────────
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("Violation Log");

    doc.moveDown(1);

    if (session.violations.length === 0) {

      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("black")
        .text("No violations detected");

    } else {

      session.violations.forEach((violation, index) => {
        doc
          .fontSize(12)
          .font("Helvetica")
          .fillColor("black")
          .text(
            `${index + 1}. ${violation.type} — ${new Date(violation.timestamp).toLocaleString()}`
          );

        doc.moveDown(0.5);
      });
    }

    doc.moveDown(2);

    // ── STEP 9–12: ANSWERS ────────────────────────────────────────
    session.answers.forEach((answer, index) => {

      // Divider line
      doc
        .moveDown(1)
        .lineWidth(2)
        .strokeColor(primaryColor)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(1);

      // Question heading
      doc
        .fillColor(primaryColor)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(
          answer.isFollowUp
            ? "Follow-up Question"
            : `Question ${index + 1}`
        );

      doc.moveDown(0.7);

      // QUESTION
      doc
        .fillColor(grayColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("QUESTION");

      doc
        .fillColor("black")
        .fontSize(13)
        .font("Helvetica")
        .text(answer.questionText);

      doc.moveDown(0.7);

      // CANDIDATE ANSWER
      doc
        .fillColor(grayColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("CANDIDATE ANSWER");

      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(answer.transcript);

      doc.moveDown(0.7);

      // EXPECTED ANSWER
      doc
        .fillColor(grayColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("EXPECTED ANSWER");

      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(answer.expectedAnswer);

      doc.moveDown(1);

      // STEP 10: SCORECARD BOX
      const boxTop = doc.y;

      doc
        .roundedRect(60, boxTop, 460, 110, 8)
        .fillAndStroke("#eff6ff", primaryColor);

      doc
        .fillColor(primaryColor)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Score Breakdown", 80, boxTop + 10);

      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica");

      doc.text(`Technical:      ${answer.score?.technical      ?? 0}/10`, 80, boxTop + 32);
      doc.text(`Communication:  ${answer.score?.communication  ?? 0}/10`, 80, boxTop + 48);
      doc.text(`Confidence:     ${answer.score?.confidence     ?? 0}/10`, 80, boxTop + 64);
      doc.text(`Problem Solving:${answer.score?.problemSolving ?? 0}/10`, 80, boxTop + 80);
      doc.text(`Overall:        ${answer.score?.overall        ?? 0}/10`, 80, boxTop + 96);

      doc.moveDown(8);

      // STEP 11: EVALUATION
      doc
        .fillColor(grayColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("EVALUATION");

      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(answer.evaluation);

      doc.moveDown(1);

      // STEP 12: TIME TAKEN
      doc
        .fillColor(primaryColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(`Time Taken: ${answer.timeTaken} sec`);

      doc.moveDown(2);
    });

    doc.end();

    stream.on("finish", () => resolve());
  });
};

export default generateInterviewPDF;
