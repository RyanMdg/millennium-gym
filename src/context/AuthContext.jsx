import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentUid = useRef(undefined)
  const profileRef = useRef(null)

  // Loads the profile whenever the signed-in user changes. Returns the profile.
  const adoptSession = useCallback(async (next) => {
    setSession(next)
    const uid = next?.user?.id ?? null
    if (uid === currentUid.current) return profileRef.current
    currentUid.current = uid
    if (!uid) {
      profileRef.current = null
      setProfile(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (currentUid.current === uid) {
      profileRef.current = data
      setProfile(data)
      setLoading(false)
    }
    return data
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // Defer: awaiting Supabase calls inside this callback can deadlock the client.
      setTimeout(() => adoptSession(next), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [adoptSession])

  const refreshProfile = useCallback(async () => {
    if (!currentUid.current) return null
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUid.current).maybeSingle()
    profileRef.current = data
    setProfile(data)
    return data
  }, [])

  const signIn = useCallback(
    async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      const p = await adoptSession(data.session)
      supabase.rpc('log_sign_in').then(() => {})
      return p
    },
    [adoptSession],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await adoptSession(null)
  }, [adoptSession])

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, adoptSession, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
