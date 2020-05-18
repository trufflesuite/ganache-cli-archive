const twofa = require("2fa")
const counter = Math.floor(Date.now() / 1000 / 30);
const otp = twofa.generateCode(process.env.NPM_OTP_KEY, counter);

console.log(otp);
