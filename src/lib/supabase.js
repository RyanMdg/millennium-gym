import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key')

// supabase.functions.invoke hides the JSON error body behind error.context.
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const payload = await error.context.json()
      if (payload?.error) message = payload.error
    } catch {
      /* keep the generic message */
    }
    throw new Error(message)
  }
  return data
}

function randomId() {
  // randomUUID only exists in secure contexts (https / localhost), not on a LAN dev URL.
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

// Phone screenshots can be several MB; scale them down before uploading.
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 800_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export async function uploadReceipt(file) {
  const body = await shrinkImage(file)
  const ext = body === file ? (file.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg'
  const path = `uploads/${randomId()}.${ext}`
  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, body, { contentType: body.type || file.type || 'image/jpeg' })
  if (error) throw new Error(`Receipt upload failed: ${error.message}`)
  return path
}
