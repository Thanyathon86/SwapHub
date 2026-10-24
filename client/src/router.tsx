import { createBrowserRouter } from 'react-router'
import ErrorPage from '@shared/components/ErrorPage'
import NotFoundPage from '@shared/components/NotFoundPage'
import { RequireAuth } from '@shared/components/RequireAuth'
import { UserLayout } from './layouts/UserLayout'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage'
import HomePage from './pages/public/HomePage'
import ListingDetailPage from './pages/public/ListingDetailPage'
import PublicProfilePage from './pages/public/PublicProfilePage'
import EditListingPage from './pages/user/EditListingPage'
import EditProfilePage from './pages/user/EditProfilePage'
import LoginPage from './pages/public/LoginPage'
import RegisterPage from './pages/public/RegisterPage'
import ResetPasswordPage from './pages/public/ResetPasswordPage'
import MyListingsPage from './pages/user/MyListingsPage'
import NewListingPage from './pages/user/NewListingPage'
import NewTicketPage from './pages/user/NewTicketPage'
import OffersPage from './pages/user/OffersPage'
import ProfilePage from './pages/user/ProfilePage'
import SettingsPage from './pages/user/SettingsPage'
import SupportListPage from './pages/user/SupportListPage'
import TicketPage from './pages/user/TicketPage'

// หน้าหลังบ้านแยกไปเป็นแอป admin/ แล้ว
export const router = createBrowserRouter([
  {
    element: <UserLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'listings/:id', element: <ListingDetailPage /> },
      { path: 'u/:username', element: <PublicProfilePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'profile/edit', element: <EditProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'sell', element: <NewListingPage /> },
          { path: 'my-listings', element: <MyListingsPage /> },
          { path: 'my-listings/:id/edit', element: <EditListingPage /> },
          { path: 'offers', element: <OffersPage /> },
          { path: 'support', element: <SupportListPage /> },
          { path: 'support/new', element: <NewTicketPage /> },
          { path: 'support/:id', element: <TicketPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
