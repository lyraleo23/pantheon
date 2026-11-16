import { NavLink, Outlet } from 'react-router-dom'
import { ChecklistIcon, DiceIcon, SettingsIcon, TargetIcon, TrophyIcon } from './icons'
import { UpdateBar } from './UpdateBar'

const TABS = [
  { to: '/', label: 'Jogos', Icon: TrophyIcon },
  { to: '/sorteio', label: 'Sorteio', Icon: DiceIcon },
  { to: '/pendentes', label: 'Pendentes', Icon: ChecklistIcon },
  { to: '/desafios', label: 'Desafios', Icon: TargetIcon },
  { to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon },
]

export function AppShell() {
  return (
    <div className="app">
      <Outlet />
      <UpdateBar />
      <nav className="tabbar">
        <div className="tabbar__inner">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
