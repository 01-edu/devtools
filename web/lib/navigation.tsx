import { HardDrive, ListTodo } from 'lucide-preact'
import { SidebarItem } from '../components/SideBar.tsx'
import { DeploymentPage } from '../pages/DeploymentPage.tsx'

export const sidebarItems: Record<string, SidebarItem> = {
  'deployment': {
    icon: HardDrive,
    label: 'Deployment',
    component: DeploymentPage,
  },
  'tasks': { icon: ListTodo, label: 'Tasks', component: DeploymentPage },
} as const
