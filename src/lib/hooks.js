import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

let settingsCache = null
const settingsListeners = new Set()

export function useSettings() {
  const [settings, setSettings] = useState(settingsCache)
  useEffect(() => {
    settingsListeners.add(setSettings)
    if (!settingsCache) {
      supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()
        .then(({ data }) => data && setSettingsCache(data))
    }
    return () => settingsListeners.delete(setSettings)
  }, [])
  return settings
}

export function setSettingsCache(next) {
  settingsCache = next
  settingsListeners.forEach((fn) => fn(next))
}

// Re-run `onChange` (debounced) whenever rows change in any of `tables`.
export function useRealtime(tables, onChange) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })
  const key = tables.join(',')
  useEffect(() => {
    let timer
    const channel = supabase.channel(`rt-${key}-${Math.random().toString(36).slice(2)}`)
    key.split(',').forEach((table) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => callback.current(), 300)
      }),
    )
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [key])
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
