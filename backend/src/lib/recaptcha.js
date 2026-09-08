const RECAPTCHA_VERIFY_URL =
  "https://www.google.com/recaptcha/api/siteverify";

export async function verifyRecaptcha(token) {
  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { success: false, errorCodes: ["recaptcha-not-configured"] };
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });

    const data = await response.json();

    return {
      success: data.success === true,
      score: data.score,
      errorCodes: data["error-codes"],
      hostname: data.hostname,
    };
  } catch {
    return { success: false, errorCodes: ["network-error"] };
  }
}
