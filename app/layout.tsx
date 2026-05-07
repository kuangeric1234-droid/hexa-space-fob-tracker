import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Hexa fob tracker',
  description: 'Fob and remote tracker for Hexa Space',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f6f6fb]">
        {user ? (
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 min-w-0">
              <div className="p-5 md:p-8 max-w-5xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        ) : (
          children
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
