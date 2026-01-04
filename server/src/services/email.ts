import { config } from "../config.js";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(payload: EmailPayload) {
  if (config.emailProvider === "console") {
    console.info("[email:console]", payload);
    return;
  }

  if (config.emailProvider === "resend") {
    if (!config.resendApiKey) {
      console.warn("[email] RESEND_API_KEY is not set; falling back to console log.");
      console.info("[email:console]", payload);
      return;
    }
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      }),
    });
    return;
  }

  if (config.emailProvider === "sendgrid") {
    if (!config.sendgridApiKey) {
      console.warn("[email] SENDGRID_API_KEY is not set; falling back to console log.");
      console.info("[email:console]", payload);
      return;
    }
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: config.emailFrom },
        subject: payload.subject,
        content: [{ type: "text/plain", value: payload.text }],
      }),
    });
  }
}
