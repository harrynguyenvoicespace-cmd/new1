'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Logo } from '@/frontend/shared/brand/Logo';
import styles from './auth-page.module.css';

type Mode = 'login' | 'signup';

function GoogleIcon() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  function finishAuth(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    window.localStorage.setItem('ugc-ai-studio.auth', JSON.stringify({ email, mode, at: Date.now() }));
    window.setTimeout(() => router.push('/dashboard'), 450);
  }

  return (
    <main className="landing-exact">
      <div className={styles.page}>
        <div className={styles.decoration} aria-hidden="true">
          <span className={styles.blobOne} />
          <span className={styles.blobTwo} />
          <span className={styles.blobThree} />
          <span className={styles.blobFour} />
          <span className={styles.blobFive} />
          <span className={styles.blobSix} />
        </div>

        <motion.section
          className={styles.panelWrap}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.brandBlock}>
            <Link href="/" className={styles.logoLink}>
              <Logo size="lg" />
            </Link>
            <p>Create events people actually want to attend</p>
          </div>

          <div className={styles.card}>
            <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === 'login' ? styles.tabActive : ''}
                onClick={() => setMode('login')}
                aria-selected={mode === 'login'}
              >
                Log in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? styles.tabActive : ''}
                onClick={() => setMode('signup')}
                aria-selected={mode === 'signup'}
              >
                Sign up
              </button>
            </div>

            <form className={styles.form} onSubmit={finishAuth}>
              {mode === 'signup' ? (
                <label className={styles.field}>
                  <span>Full name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jane Doe"
                    required={mode === 'signup'}
                  />
                </label>
              ) : null}

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>

              <button type="submit" className={styles.submitButton} disabled={loading}>
                {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            <div className={styles.divider}><span>Or</span></div>

            <button type="button" className={styles.googleButton} onClick={() => finishAuth()} disabled={loading}>
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <p className={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.section>
      </div>
    </main>
  );
}