import PDFDocument from "pdfkit";
import fs from "fs";

const PAGE_WIDTH   = 612; // PDFKit default (letter)
const MARGIN       = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 512

const generateInterviewPDF = (session, outputPath) => {
  return new Promise((resolve) => {

    const doc = new PDFDocument({ margin: MARGIN, autoFirstPage: true });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ── COLORS ────────────────────────────────────────────────────
    const primaryColor = "#2563eb";
    const dangerColor  = "#dc2626";
    const successColor = "#16a34a";
    const grayColor    = "#6b7280";
    const lightBlue    = "#eff6ff";

    // ── HELPERS ───────────────────────────────────────────────────

    /**
     * Ensure there is at least `neededHeight` pts left on the current page.
     * If not, add a new page.
     */
    const ensureSpace = (neededHeight) => {
      const bottomMargin = MARGIN;
      const pageHeight   = doc.page.height;
      if (doc.y + neededHeight > pageHeight - bottomMargin) {
        doc.addPage();
      }
    };

    /**
     * Draw a labelled text block (LABEL + body) and return the height used.
     * Constrains text to CONTENT_WIDTH so nothing escapes the margins.
     */
    const drawLabeledBlock = (label, body, labelColor = grayColor) => {
      ensureSpace(40);
      doc
        .fillColor(labelColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label, MARGIN, doc.y, { width: CONTENT_WIDTH });

      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(body || "(not provided)", MARGIN, doc.y, {
          width: CONTENT_WIDTH,
          lineGap: 2,
        });

      doc.moveDown(0.7);
    };

    // ── HEADER ────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_WIDTH, 90).fill(primaryColor);

    doc
      .fillColor("white")
      .fontSize(26)
      .font("Helvetica-Bold")
      .text("Interview Evaluation Report", MARGIN, 28, { width: CONTENT_WIDTH });

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 62, {
        width: CONTENT_WIDTH,
      });

    // ── CANDIDATE SUMMARY CARD ────────────────────────────────────
    const cardTop = 108;
    const cardLines = [
      `Name: ${session.candidate.name}`,
      `Email: ${session.candidate.email}`,
      `Role: ${session.candidate.role}`,
      `Violations: ${session.violations.length}`,
      `Interview Duration: ${Math.floor(session.interviewDuration / 60)} min ${session.interviewDuration % 60} sec`,
    ];
    const cardHeight = 30 + cardLines.length * 18 + 10;

    doc.roundedRect(MARGIN, cardTop, CONTENT_WIDTH, cardHeight, 10).stroke(primaryColor);

    doc
      .fillColor(primaryColor)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Candidate Summary", MARGIN + 16, cardTop + 12, { width: CONTENT_WIDTH - 32 });

    let lineY = cardTop + 34;
    doc.fillColor("black").fontSize(12).font("Helvetica");
    cardLines.forEach((line) => {
      doc.text(line, MARGIN + 16, lineY, { width: CONTENT_WIDTH - 32 });
      lineY += 18;
    });

    doc.y = cardTop + cardHeight + 20;

    // ── FINAL ASSESSMENT ─────────────────────────────────────────
    ensureSpace(80);
    doc
      .fillColor(primaryColor)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Final Assessment", MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(0.5);

    doc
      .fillColor("black")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(
        `Average Score: ${session.analytics?.averageScore?.toFixed(1) ?? "0.0"}/10`,
        MARGIN,
        doc.y,
        { width: CONTENT_WIDTH }
      );

    doc.moveDown(0.4);

    const rec = session.analytics?.recommendation ?? "N/A";
    doc
      .fillColor(rec === "Strong Hire" ? successColor : dangerColor)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`Recommendation: ${rec}`, MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(1);

    // ── STRENGTHS ─────────────────────────────────────────────────
    ensureSpace(40);
    doc
      .fillColor(successColor)
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Strengths", MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(0.4);

    (session.analytics?.strengths || []).forEach((item) => {
      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(`• ${item}`, MARGIN + 8, doc.y, { width: CONTENT_WIDTH - 8 });
    });

    doc.moveDown(0.8);

    // ── WEAKNESSES ────────────────────────────────────────────────
    ensureSpace(40);
    doc
      .fillColor(dangerColor)
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Weaknesses", MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(0.4);

    (session.analytics?.weaknesses || []).forEach((item) => {
      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text(`• ${item}`, MARGIN + 8, doc.y, { width: CONTENT_WIDTH - 8 });
    });

    doc.moveDown(1.5);

    // ── VIOLATION LOG ─────────────────────────────────────────────
    ensureSpace(50);
    doc
      .fillColor(primaryColor)
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Violation Log", MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(0.5);

    if (session.violations.length === 0) {
      doc
        .fillColor("black")
        .fontSize(12)
        .font("Helvetica")
        .text("No violations detected", MARGIN, doc.y, { width: CONTENT_WIDTH });
    } else {
      session.violations.forEach((violation, index) => {
        doc
          .fillColor("black")
          .fontSize(12)
          .font("Helvetica")
          .text(
            `${index + 1}. ${violation.type} — ${new Date(violation.timestamp).toLocaleString()}`,
            MARGIN,
            doc.y,
            { width: CONTENT_WIDTH }
          );
        doc.moveDown(0.4);
      });
    }

    doc.moveDown(1.5);

    // ── ANSWERS ───────────────────────────────────────────────────
    session.answers.forEach((answer, index) => {

      // Start each answer on a fresh check — add page if less than 120 pts remain
      ensureSpace(120);

      // Divider
      doc
        .lineWidth(1.5)
        .strokeColor(primaryColor)
        .moveTo(MARGIN, doc.y)
        .lineTo(PAGE_WIDTH - MARGIN, doc.y)
        .stroke();

      doc.moveDown(0.7);

      // Question heading
      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(
          answer.isFollowUp ? "Follow-up Question" : `Question ${index + 1}`,
          MARGIN,
          doc.y,
          { width: CONTENT_WIDTH }
        );

      doc.moveDown(0.6);

      // Question text
      drawLabeledBlock("QUESTION", answer.questionText);

      // Candidate answer
      drawLabeledBlock("CANDIDATE ANSWER", answer.transcript);

      // Expected answer
      drawLabeledBlock("EXPECTED ANSWER", answer.expectedAnswer);

      // ── SCORE BREAKDOWN BOX ───────────────────────────────────
      // Measure height needed: title (20) + 5 rows * 18 + padding (20)
      const scoreRows = [
        `Technical:       ${answer.score?.technical      ?? 0} / 10`,
        `Communication:   ${answer.score?.communication  ?? 0} / 10`,
        `Confidence:      ${answer.score?.confidence     ?? 0} / 10`,
        `Problem Solving: ${answer.score?.problemSolving ?? 0} / 10`,
        `Overall:         ${answer.score?.overall        ?? 0} / 10`,
      ];
      const boxPadding   = 12;
      const rowHeight    = 18;
      const boxHeight    = boxPadding + 20 + scoreRows.length * rowHeight + boxPadding;

      ensureSpace(boxHeight + 10);

      const boxTop = doc.y;
      doc
        .roundedRect(MARGIN, boxTop, CONTENT_WIDTH, boxHeight, 8)
        .fillAndStroke(lightBlue, primaryColor);

      doc
        .fillColor(primaryColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Score Breakdown", MARGIN + boxPadding, boxTop + boxPadding, {
          width: CONTENT_WIDTH - boxPadding * 2,
        });

      doc.fillColor("black").fontSize(12).font("Helvetica");

      scoreRows.forEach((row, i) => {
        doc.text(
          row,
          MARGIN + boxPadding,
          boxTop + boxPadding + 20 + i * rowHeight,
          { width: CONTENT_WIDTH - boxPadding * 2 }
        );
      });

      // Advance doc.y past the box
      doc.y = boxTop + boxHeight + 12;

      // Evaluation
      drawLabeledBlock("EVALUATION", answer.evaluation, grayColor);

      // Time taken
      ensureSpace(24);
      doc
        .fillColor(primaryColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(`Time Taken: ${answer.timeTaken} sec`, MARGIN, doc.y, {
          width: CONTENT_WIDTH,
        });

      doc.moveDown(1.5);
    });

    doc.end();
    stream.on("finish", () => resolve());
  });
};

export default generateInterviewPDF;
