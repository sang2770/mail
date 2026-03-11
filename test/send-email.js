const nodemailer = require("nodemailer");

async function sendTest() {
  let transporter = nodemailer.createTransport({
    host: "localhost",
    port: 2525,
    secure: false
  });

  await transporter.sendMail({
    from: "test@mail2.com",
    to: "jimmyandrewstguj@mail1.com",
    subject: "Your OTP Verification Code",
    text: "Your verification code is: 123456. Please use this code within 5 minutes.",
    html: "<p>Your verification code is: <strong>123456</strong>. Please use this code within 5 minutes.</p>"
  });

  console.log("Email đã gửi");
}

sendTest();
