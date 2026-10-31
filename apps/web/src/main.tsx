import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { parseWebConfig } from './config.ts'
import { I18nProvider } from './shared/i18n/index.tsx'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 }, mutations: { retry: false } },
})

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App config={parseWebConfig(import.meta.env)} />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
