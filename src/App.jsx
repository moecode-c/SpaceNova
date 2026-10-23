import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { ToastProvider, LoadingState } from './components/ui/feedback.jsx';
import { PublicLayout } from './components/layout/PublicLayout.jsx';
import { AuthLayout } from './components/layout/AuthLayout.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { RequireCapability } from './components/layout/RequireCapability.jsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.jsx';

/*
 * Screens are loaded on demand.
 *
 * The orbital engine, the map geometry and the charting library are heavy, and
 * most of them are only needed once somebody opens the tracker or a dashboard.
 * Splitting at the route keeps the first paint of the public site small.
 */

/* Public */
const Landing = lazy(() => import('./pages/public/Landing.jsx'));
const Catalog = lazy(() => import('./pages/public/Catalog.jsx'));
const ObjectDetail = lazy(() => import('./pages/public/ObjectDetail.jsx'));
const Launches = lazy(() => import('./pages/public/Launches.jsx'));
const LaunchDetail = lazy(() => import('./pages/public/LaunchDetail.jsx'));
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'));

/* Authentication */
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));

/* Observer */
const Dashboard = lazy(() => import('./pages/app/Dashboard.jsx'));
const Tracker = lazy(() => import('./pages/app/Tracker.jsx'));
const Planner = lazy(() => import('./pages/app/Planner.jsx'));
const PlanDetail = lazy(() => import('./pages/app/PlanDetail.jsx'));
const PassDetail = lazy(() => import('./pages/app/PassDetail.jsx'));
const Locations = lazy(() => import('./pages/app/Locations.jsx'));
const ObservationLog = lazy(() => import('./pages/app/ObservationLog.jsx'));
const Profile = lazy(() => import('./pages/app/Profile.jsx'));

/* Research */
const WorkspaceList = lazy(() => import('./pages/research/WorkspaceList.jsx'));
const WorkspaceDetail = lazy(() => import('./pages/research/WorkspaceDetail.jsx'));
const ProjectDetail = lazy(() => import('./pages/research/ProjectDetail.jsx'));
const DatasetDetail = lazy(() => import('./pages/research/DatasetDetail.jsx'));

/* Engineering */
const ElementSets = lazy(() => import('./pages/engineering/ElementSets.jsx'));
const DecayWatch = lazy(() => import('./pages/engineering/DecayWatch.jsx'));
const Stations = lazy(() => import('./pages/engineering/Stations.jsx'));
const StationDetail = lazy(() => import('./pages/engineering/StationDetail.jsx'));
const VehicleBuilder = lazy(() => import('./pages/engineering/VehicleBuilder.jsx'));

/* Administration */
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminCatalogue = lazy(() => import('./pages/admin/Catalogue.jsx'));
const AdminSources = lazy(() => import('./pages/admin/Sources.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/Audit.jsx'));

/** Scroll to the top on navigation, which a single-page app has to do itself. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={<LoadingState label="Loading" />}>
              <Routes>
                {/* Public site */}
                <Route element={<PublicLayout />}>
                  <Route index element={<Landing />} />
                  <Route path="catalog" element={<Catalog />} />
                  <Route path="catalog/:objectId" element={<ObjectDetail />} />
                  <Route path="launches" element={<Launches />} />
                  <Route path="launches/:launchId" element={<LaunchDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* Authentication */}
                <Route element={<AuthLayout />}>
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="verify-email" element={<VerifyEmail />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password" element={<ResetPassword />} />
                </Route>

                {/* Signed-in application */}
                <Route path="app" element={<AppShell />}>
                  <Route element={<RequireCapability capability="observe" />}>
                    <Route index element={<Dashboard />} />
                    <Route path="tracker" element={<Tracker />} />
                    <Route path="planner" element={<Planner />} />
                    <Route path="planner/:planId" element={<PlanDetail />} />
                    <Route path="pass/:objectId" element={<PassDetail />} />
                    <Route path="locations" element={<Locations />} />
                    <Route path="log" element={<ObservationLog />} />
                    <Route path="profile" element={<Profile />} />
                  </Route>

                  <Route
                    path="research"
                    element={<RequireCapability capability="research" roleNeeded="researcher" />}
                  >
                    <Route index element={<WorkspaceList />} />
                    <Route path=":workspaceId" element={<WorkspaceDetail />} />
                    <Route path=":workspaceId/:projectId" element={<ProjectDetail />} />
                    <Route
                      path=":workspaceId/:projectId/dataset/:datasetId"
                      element={<DatasetDetail />}
                    />
                  </Route>

                  <Route
                    path="engineering"
                    element={<RequireCapability capability="engineering" roleNeeded="engineer" />}
                  >
                    <Route index element={<Navigate to="element-sets" replace />} />
                    <Route path="element-sets" element={<ElementSets />} />
                    <Route path="element-sets/:objectId" element={<ElementSets />} />
                    <Route path="decay" element={<DecayWatch />} />
                    <Route path="stations" element={<Stations />} />
                    <Route path="stations/:stationId" element={<StationDetail />} />
                    <Route path="vehicles" element={<VehicleBuilder />} />
                    <Route path="vehicles/:designId" element={<VehicleBuilder />} />
                  </Route>

                  <Route
                    path="admin"
                    element={<RequireCapability capability="admin" roleNeeded="admin" />}
                  >
                    <Route index element={<Navigate to="users" replace />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="catalogue" element={<AdminCatalogue />} />
                    <Route path="sources" element={<AdminSources />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="audit" element={<AdminAudit />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
