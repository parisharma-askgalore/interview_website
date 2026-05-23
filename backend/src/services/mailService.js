import nodemailer from "nodemailer";

const transporter =
  nodemailer.createTransport({

    host: "smtp.gmail.com",  // explicit host instead of service shorthand
    port: 465,
    secure: true,            // SSL on port 465

    family: 4,               // force IPv4 — prevents ENETUNREACH on IPv6-only resolves

    auth: {

      user:
        process.env.HR_EMAIL,

      pass:
        process.env.HR_EMAIL_PASSWORD

    }

  });

// Verify connection on startup so misconfigurations are caught early
transporter.verify((error) => {
  if (error) {
    console.error("Mail transporter failed:", error.message);
  } else {
    console.log("Mail transporter ready");
  }
});

export default transporter;