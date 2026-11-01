import type { Plugin } from 'payload'

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
