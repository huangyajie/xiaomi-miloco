/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useTranslation } from 'react-i18next';
import { LoadingScreen, ErrorRetry, ConsentModal, AuthCodeModal } from '@/components';
import { useAuth, useLayout } from './hooks/index';
import { Layout } from './components';

/**
 * Home Page - Main application layout with authentication and navigation
 * 首页 - 包含身份验证和导航的主应用布局页面
 *
 * @returns {JSX.Element} Home page component with layout or loading/error states
 */
const Home = () => {
  const { t } = useTranslation();
  const {
    userInfo,
    loading,
    needRetryAuth,
    showConsentModal,
    showAuthCodeModal,
    retryAuth,
    logout,
    handleConsentAgree,
    handleConsentExit,
    handleAuthCodeSubmit,
    handleAuthCodeCancel,
    loginUrl,
  } = useAuth(t)

  const {
    selectedMenuKey,
  } = useLayout()

  if (loading && !showConsentModal && !showAuthCodeModal) {
    return (
      <LoadingScreen
        title="common.loading"
        size="default"
        loginUrl={loginUrl}
      />
    )
  }

  if (needRetryAuth) {
    return (
      <ErrorRetry
        title="error.authFailed"
        message="error.authFailedMessage"
        onRetry={retryAuth}
        loading={loading}
      />
    )
  }

  if (showConsentModal) {
    return (
      <ConsentModal
        visible={showConsentModal}
        onAgree={handleConsentAgree}
        onExit={handleConsentExit}
        t={t}
      />
    )
  }

  if (showAuthCodeModal) {
    return (
      <AuthCodeModal
        visible={showAuthCodeModal}
        onSubmit={handleAuthCodeSubmit}
        onCancel={handleAuthCodeCancel}
        t={t}
      />
    )
  }

  return (
    <Layout
      selectedMenuKeys={[selectedMenuKey]}
      userInfo={userInfo}
      onLogout={logout}
    />
  )
}

export default Home
