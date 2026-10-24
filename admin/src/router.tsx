import { createBrowserRouter } from 'react-router'
import ErrorPage from '@shared/components/ErrorPage'
import NotFoundPage from '@shared/components/NotFoundPage'
import { RequireAuth } from '@shared/components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'
import { AdminLayout } from './layouts/AdminLayout'
import AuditLogPage from './pages/AuditLogPage'
import CatalogPage from './pages/CatalogPage'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import ListingReviewPage from './pages/ListingReviewPage'
import LoginPage from './pages/LoginPage'
import SupportPage from './pages/SupportPage'
import TicketDetailPage from './pages/TicketDetailPage'
import UsersPage from './pages/UsersPage'

export const router = createBrowserRouter([
  // อยู่นอก guard เพราะต้องเข้าได้ตอนยังไม่ login
  { path: 'login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'listings', element: <ListingReviewPage /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'catalog', element: <CatalogPage /> },
              { path: 'audit', element: <AuditLogPage /> },
              { path: 'events', element: <EventsPage /> },
              { path: 'support', element: <SupportPage /> },
              { path: 'support/:id', element: <TicketDetailPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
