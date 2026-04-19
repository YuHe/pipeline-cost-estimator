import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import LoginPage from '@/pages/LoginPage';
import PipelineListPage from '@/pages/PipelineListPage';
import EditorPage from '@/pages/EditorPage';
import ShareViewPage from '@/pages/ShareViewPage';
import ComparePage from '@/pages/ComparePage';
import TrendAnalysisPage from '@/pages/TrendAnalysisPage';
import AdminPage from '@/pages/AdminPage';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:token" element={<ShareViewPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PipelineListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:id?"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <ComparePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trend"
          element={
            <ProtectedRoute>
              <TrendAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
