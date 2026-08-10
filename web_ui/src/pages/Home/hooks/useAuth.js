/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { getUserInfo, getUserLoginStatus, getUserLoginOut, setLanguage, getRefreshMiotAllInfo, refreshMiotCamera, refreshMiotScenes, refreshHaAutomation, authorizeMiot } from '@/api';
import { useSettingStore } from '@/stores/settingStore';
import { AUTH_CONFIG } from '@/constants/homeConfigTypes';

/**
 * Authentication related custom hook
 * Handle user information retrieval, OAuth authentication process, login and logout functions
 * @returns {Object} Authentication related status and methods
 */
export const useAuth = (t) => {
  const navigate = useNavigate();
  const { getLanguage } = useSettingStore();

  const [userInfo, setUserInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [needRetryAuth, setNeedRetryAuth] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false);

  const timeRef = useRef(null);
  const reqNumRef = useRef(0);
  const goToOhCodeRef = useRef(false);
  const loginUrlRef = useRef('');
  const { MAX_RETRY_ATTEMPTS, RETRY_INTERVAL } = AUTH_CONFIG;

  /**
   * Get user information
   * @returns {Promise<boolean>} Whether to successfully get user information
   */
  const fetchUserInfo = async () => {
    try {
      const res = await getUserInfo();
      const { code, data: userInfo = {} } = res || {};

      if (code !== 0) {
        navigate('/login');
        return false;
      }

      setUserInfo(userInfo);

      try {
        const refreshData = await Promise.all([refreshMiotCamera(), refreshMiotScenes(), refreshHaAutomation()]);

        const storedLanguage = getLanguage();
        if (storedLanguage) {
          await setLanguage({ language: storedLanguage });
          console.log('Language setting synchronized to server:', storedLanguage);
        }
      } catch (languageError) {
        console.warn('Failed to sync language setting to server:', languageError);
      }

      return true;
    } catch (error) {
      console.error('error:', error);
      navigate('/login');
      return false;
    }
  };

  /**
   * OAuth authentication process
   * @returns {Promise<void>}
   */
  const initFetch = async () => {
    setLoading(true);
    setNeedRetryAuth(false);

    try {
      const res = await getUserLoginStatus();
      const { code, data: resData = {} } = res || {};
      const { is_logged_in = false, login_url = '' } = resData || {};

      if (timeRef.current) {
        clearTimeout(timeRef.current);
        timeRef.current = null;
      }

      if (code === 0 && is_logged_in) {
        const success = await fetchUserInfo();
        if (success) {
          setLoading(false);
          return;
        }
      }

      if (reqNumRef.current > MAX_RETRY_ATTEMPTS) {
        message.error(t('error.authFailedRetry'));
        setNeedRetryAuth(true);
        setLoading(false);
        goToOhCodeRef.current = false;
        return;
      }

      if (code === 0 && !is_logged_in && login_url && !goToOhCodeRef.current) {
        goToOhCodeRef.current = true;
        loginUrlRef.current = login_url;
        setShowConsentModal(true);
        return;
      }

      timeRef.current = setTimeout(() => {
        initFetch();
        reqNumRef.current++;
      }, RETRY_INTERVAL);
    } catch (error) {
      console.error('OAuth error:', error);
      setNeedRetryAuth(true);
      setLoading(false);
    }
  };

  /**
   * Retry authentication
   */
  const retryAuth = () => {
    reqNumRef.current = 0;
    goToOhCodeRef.current = false;
    initFetch();
  };

  /**
   * Handle consent modal agree — open login URL then show the auth-code input modal
   */
  const handleConsentAgree = () => {
    setShowConsentModal(false);
    if (loginUrlRef.current) {
      window.open(loginUrlRef.current, '_blank');
    }
    setShowAuthCodeModal(true);
  };

  /**
   * Handle consent modal exit
   */
  const handleConsentExit = () => {
    setShowConsentModal(false);
    setNeedRetryAuth(true);
    setLoading(false);
    goToOhCodeRef.current = false;
  };

  /**
   * Handle auth code submission — POST to /api/miot/authorize then load user info
   */
  const handleAuthCodeSubmit = async ({ code, state }) => {
    const res = await authorizeMiot({ code, state });
    if (!res || res.code !== 0) {
      throw new Error(res?.message || t('authCode.errorSubmit'));
    }
    setShowAuthCodeModal(false);
    await fetchUserInfo();
    setLoading(false);
  };

  /**
   * Handle auth code modal cancel
   */
  const handleAuthCodeCancel = () => {
    setShowAuthCodeModal(false);
    setNeedRetryAuth(true);
    setLoading(false);
    goToOhCodeRef.current = false;
  };

  /**
   * User logout
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      const res = await getUserLoginOut();
      if (res?.code === 0) {
        navigate('/login');
      } else {
        message.error(t('home.userPopover.logoutFailed'));
      }
    } catch (error) {
      console.error('logout error:', error);
      message.error(t('home.userPopover.logoutFailed'));
    }
  };

  /**
   * Initialize authentication process
   */
  useEffect(() => {
    initFetch();

    return () => {
      if (timeRef.current) {
        clearTimeout(timeRef.current);
      }
    };
  }, []);

  return {
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
    loginUrl: loginUrlRef?.current,
  };
};
