import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Ganti dari email pengirim default Resend atau domain kustom terverifikasi Anda
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "EZMON <noreply@ezmon.web.id>";

interface SendResetPasswordEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendResetPasswordEmail({ to, resetUrl }: SendResetPasswordEmailParams) {
  if (!resend) {
    console.log("=================================================");
    console.log("[EMAIL SERVICE] RESEND_API_KEY tidak ditemukan!");
    console.log(`[PASSWORD RESET LINK FOR ${to}]:`);
    console.log(resetUrl);
    console.log("=================================================");
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: "Reset Password Account EZMON",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password EZMON</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">EZMON</h2>
              <p style="font-size: 14px; color: #a1a1aa; margin: 0;">Permintaan Reset Password</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px;">
              Kami menerima permintaan untuk mereset password akun EZMON Anda. Klik tombol di bawah ini untuk membuat password baru. Link ini berlaku selama 1 jam.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 500; border-radius: 8px; display: inline-block;">
                Reset Password Saya
              </a>
            </div>

            <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin-top: 32px; padding-top: 16px; border-top: 1px solid #27272a;">
              Jika Anda tidak meminta reset password ini, Anda dapat mengabaikan email ini. Password Anda tidak akan berubah.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[RESEND ERROR]", error);
      throw new Error(error.message);
    }

    return { success: true, data };
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    throw err;
  }
}
