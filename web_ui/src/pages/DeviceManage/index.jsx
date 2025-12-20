/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Spin, Empty } from 'antd';
import { Header, Icon } from '@/components';
import { DeviceList } from './components';
import { useDevices } from './hooks/useDevices';
import { useHADevices } from './hooks/useHADevices';
import styles from './index.module.less';

/**
 * DeviceManage Page - Device management page for viewing and managing connected devices
 * 设备管理页面 - 用于查看和管理已连接设备的页面
 *
 * @returns {JSX.Element} Device management page component
 */
const DeviceManage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('miot');
  
  const { devices: miotDevices, loading: miotLoading, refreshDevices: refreshMiot } = useDevices();
  const { devices: haDevices, loading: haLoading, refreshDevices: refreshHa } = useHADevices();

  const handleRefresh = () => {
    if (activeTab === 'miot') {
      refreshMiot();
    } else {
      refreshHa();
    }
  };

  const renderContent = (devices, loading, emptyText) => {
      if (loading) {
          return <div style={{display: 'flex', justifyContent: 'center', padding: '50px 0'}}><Spin /></div>;
      }
      if (!devices || devices.length === 0) {
           return <Empty 
              description={emptyText} 
              imageStyle={{ width: 72, height: 72 }}
            />;
      }
      return <DeviceList devices={devices} />;
  }

  const tabItems = [
    {
      key: 'miot',
      label: t('deviceManage.miotDevices'),
      children: renderContent(miotDevices, miotLoading, t('deviceManage.noDevice'))
    },
    {
      key: 'ha',
      label: t('deviceManage.haDevices'),
      children: renderContent(haDevices, haLoading, t('deviceManage.noDevice'))
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <Header title={t('home.menu.deviceManage')} />
        <div className={styles.tabContainer}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className={styles.tabs}
            tabBarExtraContent={{
              right: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={handleRefresh}
                >
                  <Icon
                    name="refresh"
                    size={15}
                    style={{ color: 'var(--text-color)' }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-color)', marginLeft: '6px' }}>{t('common.refresh')}</span>
                </div>
              )
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DeviceManage;