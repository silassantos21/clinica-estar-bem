import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import path from 'path'

let sock: ReturnType<typeof makeWASocket> | null = null
let qrDataUrl: string | null = null
let connected = false
let reconnecting = false

const AUTH_DIR =
  process.env.BAILEYS_AUTH_DIR ?? path.join(process.cwd(), 'baileys-auth')

export function getWAStatus(): { connected: boolean; qrDataUrl?: string } {
  return { connected, qrDataUrl: qrDataUrl ?? undefined }
}

export async function requestPairingCode(phone: string): Promise<string> {
  if (!sock) throw new Error('WhatsApp não inicializado')
  if (connected) throw new Error('WhatsApp já está conectado')
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('Número inválido')
  const code = await sock.requestPairingCode(normalized)
  return code
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function sendWA(
  phone: string | null | undefined,
  message: string,
): Promise<void> {
  if (!phone || !sock || !connected) return
  const normalized = normalizePhone(phone)
  if (!normalized) return
  try {
    await sock.sendMessage(`${normalized}@s.whatsapp.net`, { text: message })
  } catch (e) {
    console.error('[WhatsApp] Falha ao enviar:', e)
  }
}

export async function initWhatsApp(): Promise<void> {
  if (reconnecting) return
  reconnecting = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        qrDataUrl = await QRCode.toDataURL(qr)
        console.log('[WhatsApp] QR gerado — acesse GET /whatsapp/status para visualizar')
      }

      if (connection === 'open') {
        connected = true
        reconnecting = false
        qrDataUrl = null
        console.log('[WhatsApp] Conectado:', sock?.user?.id)
      }

      if (connection === 'close') {
        connected = false
        reconnecting = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('[WhatsApp] Reconectando em 5s...')
          setTimeout(initWhatsApp, 5000)
        } else {
          console.log('[WhatsApp] Logout — escaneie novamente via painel admin')
          qrDataUrl = null
        }
      }
    })
  } catch (e) {
    reconnecting = false
    console.error('[WhatsApp] Erro ao inicializar:', e)
    setTimeout(initWhatsApp, 10000)
  }
}
