import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function credenciaisHtml(name: string, email: string, password: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seus dados de acesso — Núcleo Estar Bem</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Cabeçalho -->
          <tr>
            <td style="background:#C01C63;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                Núcleo Estar Bem
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">
                Sistema de Agendamento
              </p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">
                Olá, ${name}!
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.6;">
                Seu acesso ao sistema foi criado. Use as credenciais abaixo para entrar pela primeira vez.
              </p>

              <!-- Bloco de credenciais -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F0F5;border:1px solid #F7B0D5;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9A1450;text-transform:uppercase;letter-spacing:0.8px;">E-mail</p>
                          <p style="margin:0;font-size:15px;color:#111827;font-weight:500;">${email}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px solid #F7B0D5;padding-top:14px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9A1450;text-transform:uppercase;letter-spacing:0.8px;">Senha</p>
                          <p style="margin:0;font-size:18px;color:#111827;font-weight:700;font-family:monospace;letter-spacing:1px;">${password}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botão de acesso -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}"
                       style="display:inline-block;background:#C01C63;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
                      Acessar o sistema
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;text-align:center;">
                Recomendamos alterar a senha após o primeiro acesso.<br>
                Em caso de dúvidas, entre em contato com a administração.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background:#F9F0F5;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #F7B0D5;">
              <p style="margin:0;font-size:12px;color:#9A1450;">
                © ${new Date().getFullYear()} Núcleo Estar Bem — mensagem automática, não responda este e-mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendCredentialsEmail(
  to: string,
  name: string,
  password: string,
): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? ''

  try {
    const transporter = createTransport()
    await transporter.sendMail({
      from: `"Núcleo Estar Bem" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Seus dados de acesso — Núcleo Estar Bem',
      html: credenciaisHtml(name, to, password, appUrl),
    })
    console.log(`[Mailer] Credenciais enviadas para ${to}`)
  } catch (e) {
    console.error('[Mailer] Falha ao enviar e-mail de credenciais:', e)
  }
}
