import { HardDrive, ListTodo, Wrench } from 'lucide-preact'
import { SidebarItem } from '../components/SideBar.tsx'
import { DeploymentPage } from '../pages/DeploymentPage.tsx'
import { ToolsPage } from '../pages/ToolsPage.tsx'

export const sidebarItems: Record<string, SidebarItem> = {
  'deployment': {
    icon: HardDrive,
    label: 'Deployment',
    component: DeploymentPage,
  },
  'tools': {
    icon: Wrench,
    label: 'Tools',
    component: ToolsPage,
  },
  'tasks': { icon: ListTodo, label: 'Tasks', component: DeploymentPage },
} as const
