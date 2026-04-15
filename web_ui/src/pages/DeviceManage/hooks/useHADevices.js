/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { getHADeviceList, getHiddenHADevices, hideHADevices, restoreHADevices } from '@/api';

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

  const removeDevices = useCallback(async (deviceIds) => {
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      message.warning(t('deviceManage.selectDeviceFirst'));
      return false;
    }
    const res = await hideHADevices({ device_ids: deviceIds });
    if (res?.code === 0) {
      message.success(t('deviceManage.removeSuccess'));
      await fetchDevices();
      return true;
    }
    message.error(res?.message || t('deviceManage.removeFailed'));
    return false;
  }, [fetchDevices, t]);

  const fetchHiddenDevices = useCallback(async () => {
    const response = await getHiddenHADevices();
    if (response?.code === 0) {
      return response.data || [];
    }
    message.error(response?.message || t('deviceManage.fetchHiddenFailed'));
    return [];
  }, [t]);

  const restoreDevices = useCallback(async (deviceIds) => {
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      message.warning(t('deviceManage.selectDeviceFirst'));
      return false;
    }
    const res = await restoreHADevices({ device_ids: deviceIds });
    if (res?.code === 0) {
      message.success(t('deviceManage.restoreSuccess'));
      await fetchDevices();
      return true;
    }
    message.error(res?.message || t('deviceManage.restoreFailed'));
    return false;
  }, [fetchDevices, t]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    refreshDevices,
    removeDevices,
    fetchHiddenDevices,
    restoreDevices
  };
};
