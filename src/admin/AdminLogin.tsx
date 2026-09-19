import { useState, type FormEvent } from 'react'
import { login } from './admin-api'
import {usesEdgeApi} from '../lib/api-endpoint'

interface AdminLoginProps {
  onSuccess(): void
}
export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await login(username, password)
      onSuccess()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <a className="brand" href={usesEdgeApi ? window.location.pathname : '/'} aria-label="解码学习首页">
          <span className="brand-mark">D</span><span>解码学习</span>
        </a>
        <p className="admin-eyebrow">内部管理</p>
        <h1>管理员登录</h1>
        <p>请使用机构内部账号查看已保存的测评报告。</p>
        <label htmlFor="admin-username">用户名</label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label htmlFor="admin-password">密码</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="admin-error" role="alert">{error}</p> : null}
        <button className="admin-primary-button" type="submit" disabled={submitting}>
          {submitting ? '正在登录…' : '登录'}
        </button>
      </form>
    </main>
  )
}
