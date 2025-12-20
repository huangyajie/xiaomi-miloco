/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getHADeviceList } from '@/api';

export const useHADevices = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getHADeviceList();

      if (response.code === 0) {
        setDevices(response.data || []);
      } else {
        setError(response.message || t('deviceManage.fetchDeviceListFailed'));
      }
    } catch (err) {
      setError(t('deviceManage.fetchDeviceListFailed'));
      console.error('fetchHADeviceListFailed:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const refreshDevices = useCallback(async () => {
      await fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    refreshDevices
  };
};
