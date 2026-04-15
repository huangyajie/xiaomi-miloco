/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeviceList, getHiddenMiotDevices, hideMiotDevices, refreshMiotDevices, restoreMiotDevices } from '@/api';
import { message } from 'antd';

export const useDevices = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getDeviceList();

      if (response.code === 0) {
        // sort by order: online but not set password > online and set password > offline and set password > offline and not set password
        const sortedDevices = response.data.sort((a, b) => {
          // get device type weight
          const getDeviceWeight = (device) => {
            if (device.online && device.is_set_pincode <= 0) {
              return 1; // online but not set password
            } else if (device.online && device.is_set_pincode > 0) {
              return 2; // online and set password
            } else if (!device.online && device.is_set_pincode > 0) {
              return 3; // offline and set password
            } else {
              return 4; // offline and not set password
            }
          };

          const weightA = getDeviceWeight(a);
          const weightB = getDeviceWeight(b);

          return weightA - weightB;
        });
        setDevices(sortedDevices || []);
      } else {
        setDevices([]);
        setError(response.message || t('deviceManage.fetchDeviceListFailed'));
      }
    } catch (err) {
      setDevices([]);
      setError(t('deviceManage.fetchDeviceListFailed'));
      console.error('fetchDeviceListFailed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    setLoading(true);
    const res = await refreshMiotDevices();
    if (res.code === 0) {
      await fetchDevices();
    } else {
      message.error(res.message || t('deviceManage.refreshDeviceListFailed'));
    }
    setLoading(false);
  }, [fetchDevices]);

  const removeDevices = useCallback(async (deviceIds) => {
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      message.warning(t('deviceManage.selectDeviceFirst'));
      return false;
    }
    const res = await hideMiotDevices({ device_ids: deviceIds });
    if (res?.code === 0) {
      message.success(t('deviceManage.removeSuccess'));
      await fetchDevices();
      return true;
    }
    message.error(res?.message || t('deviceManage.removeFailed'));
    return false;
  }, [fetchDevices, t]);

  const fetchHiddenDevices = useCallback(async () => {
    const response = await getHiddenMiotDevices();
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
    const res = await restoreMiotDevices({ device_ids: deviceIds });
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
