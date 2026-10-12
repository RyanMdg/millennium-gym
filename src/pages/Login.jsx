import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { Heading, PublicShell } from '../components/PublicShell'
import { useAuth } from '../context/AuthContext'

const homeFor = (profile) => (profile?.role === 'admin' ? '/admin' : '/me')

export default function Login() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next') : null

  if (!loading && profile) return <Navigate to={next ?? homeFor(profile)} replace />

  return (
    <PublicShell
      footer={
        <>
          Not a member yet?{' '}
          <Link to="/register" className="text-white underline-offset-4 hover:underline">
            Register here
          </Link>
        </>
      }
    >
      <Heading title="Log in" />
      <LoginForm onSuccess={(p) => navigate(next ?? homeFor(p), { replace: true })} />
    </PublicShell>
  )
}
