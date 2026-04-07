import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions";
import axios from "axios";

setGlobalOptions({ maxInstances: 10 });

export const sendTeamEmail = onCall({ 
  cors: true,          // ✅ This allows the browser to make the request
  maxInstances: 10 
}, async (request) => {
  // 1. Security Check: Ensure user is logged into your app
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { to, subject, html } = request.data;
  
  // 2. Get API Key from Firebase Environment (or hardcode for now)
  // Best practice: firebase functions:secrets:set RESEND_API_KEY
  const apiKey = "re_iaJkUNUT_9Nev4nfjiZ61k1Y14QUuBV6e"; 

  try {
    const response = await axios.post(
      "https://api.resend.com/emails",
      {
        from: "TeamUp <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Email failed");
  }
});