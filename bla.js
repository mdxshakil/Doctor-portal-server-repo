const nodemailer = require('nodemailer');
const sibTransport = require('nodemailer-sendinblue-transport');
require('dotenv').config();

const emailSenderOptions = {
    auth: {
        api_key: process.env.EMAIL_SENDER_KEY
    }
}

const emailClient = nodemailer.createTransport(sibTransport(emailSenderOptions))

const email = {
    from: process.env.EMAIL_SENDER,
    to: 'example@gmail.com',
    subject: `This is a test email`,
    text: `This is a test email`,
    html: `
            <div>
                <h1>Hello XXX</h1>
                <h3>Your appoinment is confirmed</h3>
                <p>Looking forward to see you.</p>
            </div>
            `
};

emailClient.sendMail(email, function (err, info) {
    if (err) {
        console.log(err);
    }
    else {
        console.log('message sent: ', info);
    }
});