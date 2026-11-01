import type { Plugin } from 'payload'

import { dashboardWidgets, defaultLayout } from '@/components/admin/dashboard/native-widgets'

/**
 * Puts the CILAS dashboard on the admin home. Place it after `payloadTheme()`:
 * the theme sets the same slot, and the last plugin wins. `DashboardView`
 * gives admins the statistics and hands everyone else back to the theme's own
 * dashboard (docs/research/admin-dashboard.md).
 */
export const adminDashboard = (): Plugin => (config) => ({
  ...config,
  admin: {
    ...config.admin,
    dashboard: { widgets: dashboardWidgets, defaultLayout },
    components: {
      ...config.admin?.components,
      views: {
        ...config.admin?.components?.views,
        dashboard: {
          ...config.admin?.components?.views?.dashboard,
          Component: '/components/admin/dashboard/dashboard-view#DashboardView',
        },
      },
    },
  },
})
