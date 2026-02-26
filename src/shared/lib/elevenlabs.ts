const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'
const MODEL_ID = 'eleven_multilingual_v2'

let currentAudio: HTMLAudioElement | null = null

export function hasElevenLabsKey(): boolean {
  return !!API_KEY?.trim()
}

export async function speakWithElevenLabs(text: string): Promise<void> {
  if (!text.trim()) return
  if (!API_KEY) {
    throw new Error('API key not configured. Add VITE_ELEVENLABS_API_KEY to .env')
  }

  // Stop any ongoing playback
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': API_KEY,
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: MODEL_ID,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail?.message || err.message || `API error: ${res.status}`)
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  currentAudio = new Audio(objectUrl)

  return new Promise((resolve, reject) => {
    if (!currentAudio) return
    currentAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(objectUrl)
      currentAudio = null
      resolve()
    })
    currentAudio.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      currentAudio = null
      reject(new Error('Playback error'))
    })
    currentAudio.play().catch(reject)
  })
}
