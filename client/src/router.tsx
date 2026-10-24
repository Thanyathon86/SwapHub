import { createBrowserRouter } from 'react-router'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { UserLayout } from './layouts/UserLayout'
import ErrorPage from './pages/public/ErrorPage'
import HomePage from './pages/public/HomePage'
import ListingDetailPage from './pages/public/ListingDetailPage'
import LoginPage from './pages/public/LoginPage'
import NotFoundPage from './pages/public/NotFoundPage'
import RegisterPage from './pages/public/RegisterPage'
import MyListingsPage from './pages/user/MyListingsPage'
import NewListingPage from './pages/user/NewListingPage'
import OffersPage from './pages/user/OffersPage'
import ProfilePage from './pages/user/ProfilePage'
import SettingsPage from './pages/user/SettingsPage'

export const router = createBrowserRouter([
  {
    element: <UserLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'listings/:id', element: <ListingDetailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'sell', element: <NewListingPage /> },
          { path: 'my-listings', element: <MyListingsPage /> },
          { path: 'offers', element: <OffersPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // แยกโค้ดหลังบ้านเป็น chunk ต่างหาก user ทั่วไปจะไม่ต้องโหลด
    path: 'admin',
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <RequireAdmin />,
        children: [
          {
            lazy: async () => ({ Component: (await import('./layouts/AdminLayout')).AdminLayout }),
            children: [
              { index: true, lazy: async () => ({ Component: (await import('./pages/admin/DashboardPage')).default }) },
              {
                path: 'listings',
                lazy: async () => ({ Component: (await import('./pages/admin/ListingReviewPage')).default }),
              },
              { path: 'users', lazy: async () => ({ Component: (await import('./pages/admin/UsersPage')).default }) },
              { path: 'catalog', lazy: async () => ({ Component: (await import('./pages/admin/CatalogPage')).default }) },
            ],
          },
        ],
      },
    ],
  },
])
