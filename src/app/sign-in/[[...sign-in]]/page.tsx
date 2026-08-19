import { SignIn } from '@clerk/nextjs';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { getServerLocale } from '@/i18n/server';

export default async function SignInPage() {
  const locale = await getServerLocale();
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      background: 'var(--color-bg)',
    }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '180px' }}>
        <LanguageSwitcher initialLocale={locale} />
      </div>
      <SignIn />
    </main>
  );
}
