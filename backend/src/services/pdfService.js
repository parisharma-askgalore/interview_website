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

    // HEADER

    doc
      .fontSize(22)
      .text(
        "Interview Evaluation Report",
        {
          align: "center"
        }
      );

    doc.moveDown(2);

    // CANDIDATE INFO

    doc
      .fontSize(16)
      .text("Candidate Information");

    doc.moveDown(0.5);

    doc
      .fontSize(12)
      .text(
        `Name: ${session.candidate.name}`
      );

    doc.text(
      `Email: ${session.candidate.email}`
    );

    doc.text(
      `Role:
      ${session.candidate.role}`
    );

    doc.moveDown(0.5);

    doc.text(
      `Violations:
      ${session.violations.length}`
    );

    doc.moveDown(0.5);

    doc.text(
      `Termination:
      ${session.terminationReason || "None"}`
    );

    doc.moveDown(2);

    // ANSWERS

    doc
      .fontSize(16)
      .text("Violation Log");

    doc.moveDown(1);

    if (
      session.violations.length === 0
    ) {

      doc
        .fontSize(12)
        .text("No violations detected");

    } else {

      session.violations.forEach(

        (violation, index) => {

          doc
            .fontSize(12)
            .text(

              `
              ${index + 1}.
              ${violation.type}

              Time:
              ${new Date(
                violation.timestamp
              ).toLocaleString()}
              `
            );

          doc.moveDown(0.5);

        }
      );
    }

    doc.moveDown(2);

    session.answers.forEach(
      (answer, index) => {

        doc
          .fontSize(16)
          .text(
            `Question ${index + 1}`
          );

        doc.moveDown(0.5);

        doc
          .fontSize(12)
          .text(
            `Question:
            ${answer.questionText}`
          );

        doc.moveDown(0.5);

        doc.text(
          `Candidate Answer:
          ${answer.transcript}`
        );

        doc.moveDown(0.5);

        doc.text(
          `Expected Answer:
          ${answer.expectedAnswer}`
        );

        doc.moveDown(0.5);

        doc.text(
          `Score:
          ${answer.score}`
        );

        doc.moveDown(0.5);

        doc.text(
          `Evaluation:
          ${answer.evaluation}`
        );

        doc.moveDown(2);

      }
    );

    doc.end();

    stream.on(
      "finish",

      () => resolve()
    );

  });
};

export default generateInterviewPDF;