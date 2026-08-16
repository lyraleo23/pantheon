import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GamesPage } from './pages/GamesPage'
import { GamePage } from './pages/GamePage'
import { SettingsPage } from './pages/SettingsPage'

/**
 * HashRouter em vez de BrowserRouter: o GitHub Pages não reescreve rotas para
 * o index.html, então qualquer link direto daria 404 com paths reais.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<GamesPage />} />
          <Route path="/jogo/:slug" element={<GamePage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
