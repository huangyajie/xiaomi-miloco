/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Empty, Input, Modal, Popconfirm, Spin, Tabs } from 'antd';
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
  const [selectedMiotIds, setSelectedMiotIds] = useState([]);
  const [selectedHaIds, setSelectedHaIds] = useState([]);
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  const [hiddenActiveTab, setHiddenActiveTab] = useState('miot');
  const [hiddenMiotDevices, setHiddenMiotDevices] = useState([]);
  const [hiddenHaDevices, setHiddenHaDevices] = useState([]);
  const [hiddenMiotSelectedIds, setHiddenMiotSelectedIds] = useState([]);
  const [hiddenHaSelectedIds, setHiddenHaSelectedIds] = useState([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [miotSearch, setMiotSearch] = useState('');
  const [haSearch, setHaSearch] = useState('');
  const [hiddenMiotSearch, setHiddenMiotSearch] = useState('');
  const [hiddenHaSearch, setHiddenHaSearch] = useState('');
  
  const {
    devices: miotDevices,
    loading: miotLoading,
    refreshDevices: refreshMiot,
    removeDevices: removeMiotDevices,
    fetchHiddenDevices: fetchHiddenMiotDevices,
    restoreDevices: restoreMiotDevices
  } = useDevices();
  const {
    devices: haDevices,
    loading: haLoading,
    refreshDevices: refreshHa,
    removeDevices: removeHaDevices,
    fetchHiddenDevices: fetchHiddenHaDevices,
    restoreDevices: restoreHADevices
  } = useHADevices();

  const isMiotTab = activeTab === 'miot';
  const currentDevices = isMiotTab ? miotDevices : haDevices;
  const selectedIds = isMiotTab ? selectedMiotIds : selectedHaIds;
  const setSelectedIds = isMiotTab ? setSelectedMiotIds : setSelectedHaIds;
  const hiddenCurrentDevices = hiddenActiveTab === 'miot' ? hiddenMiotDevices : hiddenHaDevices;
  const hiddenSelectedIds = hiddenActiveTab === 'miot' ? hiddenMiotSelectedIds : hiddenHaSelectedIds;
  const setHiddenSelectedIds = hiddenActiveTab === 'miot' ? setHiddenMiotSelectedIds : setHiddenHaSelectedIds;
  const currentSearch = isMiotTab ? miotSearch : haSearch;
  const hiddenCurrentSearch = hiddenActiveTab === 'miot' ? hiddenMiotSearch : hiddenHaSearch;

  const handleRefresh = () => {
    if (activeTab === 'miot') {
      refreshMiot();
    } else {
      refreshHa();
    }
  };

  const handleToggleSelect = (deviceId, checked) => {
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(deviceId) ? prev : [...prev, deviceId];
      }
      return prev.filter((id) => id !== deviceId);
    });
  };

  const handleToggleSelectMany = (deviceIds, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deviceIds.forEach((deviceId) => {
        if (checked) {
          next.add(deviceId);
        } else {
          next.delete(deviceId);
        }
      });
      return Array.from(next);
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(currentDevices.map((device) => device.did));
      return;
    }
    setSelectedIds([]);
  };

  const handleRemoveDevices = async (tabKey, deviceIds) => {
    const removeHandler = tabKey === 'miot' ? removeMiotDevices : removeHaDevices;
    const clearSelection = tabKey === 'miot' ? setSelectedMiotIds : setSelectedHaIds;
    const success = await removeHandler(deviceIds);
    if (success) {
      clearSelection((prev) => prev.filter((id) => !deviceIds.includes(id)));
    }
  };

  const filterDevices = (devices, query) => {
    const keyword = (query || '').trim().toLowerCase();
    if (!keyword) {
      return devices;
    }
    return devices.filter((device) => {
      const haystack = [
        device.did,
        device.entity_id,
        device.name,
        device.room_name,
        device.home_name,
        device.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  };

  const loadHiddenDevices = async () => {
    setHiddenLoading(true);
    try {
      const [miotHidden, haHidden] = await Promise.all([
        fetchHiddenMiotDevices(),
        fetchHiddenHaDevices(),
      ]);
      setHiddenMiotDevices(miotHidden);
      setHiddenHaDevices(haHidden);
      setHiddenMiotSelectedIds([]);
      setHiddenHaSelectedIds([]);
    } finally {
      setHiddenLoading(false);
    }
  };

  const handleOpenHiddenModal = async () => {
    setHiddenModalOpen(true);
    await loadHiddenDevices();
  };

  const handleHiddenSelectAll = (checked) => {
    if (checked) {
      setHiddenSelectedIds(hiddenCurrentDevices.map((device) => device.did));
      return;
    }
    setHiddenSelectedIds([]);
  };

  const handleToggleHiddenSelect = (deviceId, checked) => {
    setHiddenSelectedIds((prev) => {
      if (checked) {
        return prev.includes(deviceId) ? prev : [...prev, deviceId];
      }
      return prev.filter((id) => id !== deviceId);
    });
  };

  const handleToggleHiddenSelectMany = (deviceIds, checked) => {
    setHiddenSelectedIds((prev) => {
      const next = new Set(prev);
      deviceIds.forEach((deviceId) => {
        if (checked) {
          next.add(deviceId);
        } else {
          next.delete(deviceId);
        }
      });
      return Array.from(next);
    });
  };

  const handleRestoreDevices = async (tabKey, deviceIds) => {
    const restoreHandler = tabKey === 'miot' ? restoreMiotDevices : restoreHADevices;
    const setHiddenDevices = tabKey === 'miot' ? setHiddenMiotDevices : setHiddenHaDevices;
    const clearHiddenSelection = tabKey === 'miot' ? setHiddenMiotSelectedIds : setHiddenHaSelectedIds;
    const success = await restoreHandler(deviceIds);
    if (success) {
      setHiddenDevices((prev) => prev.filter((device) => !deviceIds.includes(device.did)));
      clearHiddenSelection((prev) => prev.filter((id) => !deviceIds.includes(id)));
    }
  };

  const renderContent = (tabKey, devices, loading, emptyText) => {
      const tabSelectedIds = tabKey === 'miot' ? selectedMiotIds : selectedHaIds;
      if (loading) {
          return <div style={{display: 'flex', justifyContent: 'center', padding: '50px 0'}}><Spin /></div>;
      }
      const filteredDevices = filterDevices(devices, tabKey === 'miot' ? miotSearch : haSearch);
      if (!filteredDevices || filteredDevices.length === 0) {
           return <Empty 
              description={emptyText} 
              imageStyle={{ width: 72, height: 72 }}
            />;
      }
      return (
        <DeviceList
          devices={filteredDevices}
          selectedIds={tabSelectedIds}
          onToggleSelect={(deviceId, checked) => {
            setActiveTab(tabKey);
            handleToggleSelect(deviceId, checked);
          }}
          onToggleSelectMany={(deviceIds, checked) => {
            setActiveTab(tabKey);
            handleToggleSelectMany(deviceIds, checked);
          }}
          onDeleteDevice={(deviceId) => handleRemoveDevices(tabKey, [deviceId])}
        />
      );
  }

  const renderHiddenContent = (tabKey, devices) => {
    const tabSelectedIds = tabKey === 'miot' ? hiddenMiotSelectedIds : hiddenHaSelectedIds;
    if (hiddenLoading) {
      return <div style={{display: 'flex', justifyContent: 'center', padding: '50px 0'}}><Spin /></div>;
    }
    const filteredDevices = filterDevices(devices, tabKey === 'miot' ? hiddenMiotSearch : hiddenHaSearch);
    if (!filteredDevices || filteredDevices.length === 0) {
      return <Empty description={t('deviceManage.noHiddenDevice')} imageStyle={{ width: 72, height: 72 }} />;
    }
    return (
      <DeviceList
        devices={filteredDevices}
        selectedIds={tabSelectedIds}
        onToggleSelect={(deviceId, checked) => {
          setHiddenActiveTab(tabKey);
          handleToggleHiddenSelect(deviceId, checked);
        }}
        onToggleSelectMany={(deviceIds, checked) => {
          setHiddenActiveTab(tabKey);
          handleToggleHiddenSelectMany(deviceIds, checked);
        }}
        onRestoreDevice={(deviceId) => handleRestoreDevices(tabKey, [deviceId])}
        actionType="restore"
      />
    );
  };

  const tabItems = [
    {
      key: 'miot',
      label: t('deviceManage.miotDevices'),
      children: renderContent('miot', miotDevices, miotLoading, t('deviceManage.noDevice'))
    },
    {
      key: 'ha',
      label: t('deviceManage.haDevices'),
      children: renderContent('ha', haDevices, haLoading, t('deviceManage.noDevice'))
    }
  ];

  const hiddenTabItems = [
    {
      key: 'miot',
      label: t('deviceManage.miotDevices'),
      children: renderHiddenContent('miot', hiddenMiotDevices)
    },
    {
      key: 'ha',
      label: t('deviceManage.haDevices'),
      children: renderHiddenContent('ha', hiddenHaDevices)
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <Header title={t('home.menu.deviceManage')} />
        <div className={styles.tabContainer}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input.Search
                value={currentSearch}
                onChange={(event) => {
                  if (activeTab === 'miot') {
                    setMiotSearch(event.target.value);
                  } else {
                    setHaSearch(event.target.value);
                  }
                }}
                allowClear
                placeholder={t('deviceManage.searchPlaceholder')}
                className={styles.searchInput}
              />
              <Checkbox
                checked={currentDevices.length > 0 && selectedIds.length === currentDevices.length}
                indeterminate={selectedIds.length > 0 && selectedIds.length < currentDevices.length}
                onChange={(event) => handleSelectAll(event.target.checked)}
              >
                {t('common.selectAll')}
              </Checkbox>
              {selectedIds.length > 0 && (
                <span className={styles.selectedCount}>
                  {t('deviceManage.selectedCount', { count: selectedIds.length })}
                </span>
              )}
            </div>
            <div className={styles.toolbarRight}>
              <Button onClick={handleOpenHiddenModal}>
                {t('deviceManage.hiddenDevices')}
              </Button>
              {selectedIds.length > 0 && (
                <Popconfirm
                  title={t('deviceManage.removeSelectedConfirm')}
                  onConfirm={() => handleRemoveDevices(activeTab, selectedIds)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button danger>
                    {t('deviceManage.removeSelected')}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
            }}
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
      <Modal
        title={t('deviceManage.hiddenDevices')}
        open={hiddenModalOpen}
        onCancel={() => setHiddenModalOpen(false)}
        footer={null}
        width={960}
        destroyOnClose
      >
        <div className={styles.hiddenToolbar}>
          <div className={styles.toolbarLeft}>
            <Input.Search
              value={hiddenCurrentSearch}
              onChange={(event) => {
                if (hiddenActiveTab === 'miot') {
                  setHiddenMiotSearch(event.target.value);
                } else {
                  setHiddenHaSearch(event.target.value);
                }
              }}
              allowClear
              placeholder={t('deviceManage.searchPlaceholder')}
              className={styles.searchInput}
            />
            <Checkbox
              checked={hiddenCurrentDevices.length > 0 && hiddenSelectedIds.length === hiddenCurrentDevices.length}
              indeterminate={hiddenSelectedIds.length > 0 && hiddenSelectedIds.length < hiddenCurrentDevices.length}
              onChange={(event) => handleHiddenSelectAll(event.target.checked)}
            >
              {t('common.selectAll')}
            </Checkbox>
            {hiddenSelectedIds.length > 0 && (
              <span className={styles.selectedCount}>
                {t('deviceManage.selectedCount', { count: hiddenSelectedIds.length })}
              </span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {hiddenSelectedIds.length > 0 && (
              <Popconfirm
                title={t('deviceManage.restoreSelectedConfirm')}
                onConfirm={() => handleRestoreDevices(hiddenActiveTab, hiddenSelectedIds)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button type="primary">
                  {t('deviceManage.restoreSelected')}
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
        <Tabs
          activeKey={hiddenActiveTab}
          onChange={setHiddenActiveTab}
          items={hiddenTabItems}
          className={styles.tabs}
        />
      </Modal>
    </div>
  );
};

export default DeviceManage;
