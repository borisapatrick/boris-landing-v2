const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const twilio = require("twilio");

const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = defineSecret("TWILIO_PHONE_NUMBER");

exports.sendSms = onDocumentCreated(
  {
    document: "sms/{docId}",
    secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
  },
  async (event) => {
    // SMS DISABLED — Remove this block to re-enable once Twilio verification is complete
    console.log("SMS sending is currently disabled. Skipping.");
    return;
    // END DISABLED BLOCK

    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data in document");
      return;
    }

    const smsData = snapshot.data();
    const { to, body } = smsData;

    if (!to || !body) {
      console.error("SMS document missing 'to' or 'body' field:", smsData);
      await snapshot.ref.update({
        "delivery.state": "ERROR",
        "delivery.error": "Missing 'to' or 'body' field",
        "delivery.endTime": new Date(),
      });
      return;
    }

    try {
      const client = twilio(
        twilioAccountSid.value(),
        twilioAuthToken.value()
      );

      const message = await client.messages.create({
        to: to,
        from: twilioPhoneNumber.value(),
        body: body,
      });

      console.log("SMS sent successfully. SID:", message.sid);

      await snapshot.ref.update({
        "delivery.state": "SUCCESS",
        "delivery.messageSid": message.sid,
        "delivery.endTime": new Date(),
      });
    } catch (error) {
      console.error("Error sending SMS:", error.message);

      await snapshot.ref.update({
        "delivery.state": "ERROR",
        "delivery.error": error.message,
        "delivery.endTime": new Date(),
      });
    }
  }
);
