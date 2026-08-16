import { NavLink, Outlet } from 'react-router-dom'
import { ChecklistIcon, SettingsIcon, TrophyIcon } from './icons'

const TABS = [
  { to: '/', label: 'Jogos', Icon: TrophyIcon },
  { to: '/pendentes', label: 'Pendentes', Icon: ChecklistIcon },
  { to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon },
]

export function AppShell() {
  return (
    <div className="app">
      <Outlet />
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
