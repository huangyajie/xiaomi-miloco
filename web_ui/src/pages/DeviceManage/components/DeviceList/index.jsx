/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React from 'react';
import { Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import DeviceCard from '../DeviceCard';
import styles from './index.module.less';

/**
 * DeviceList Component - Device list component
 * 设备列表组件
 *
 * @param {Object} devices - The devices data to display
 * @returns {JSX.Element} Device list component
 */
const DeviceList = ({
  devices,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectMany,
  onDeleteDevice,
  onRestoreDevice,
  actionType = 'remove'
}) => {
  const { t } = useTranslation();
  const groupedDevices = devices.reduce((acc, device) => {
    const roomName = (device.room_name || '').trim();
    const homeName = (device.home_name || '').trim();
    const areaLabel = roomName
      ? (homeName && homeName !== roomName ? `${homeName} / ${roomName}` : roomName)
      : t('deviceManage.defaultRoom');
    if (!acc[areaLabel]) {
      acc[areaLabel] = [];
    }
    acc[areaLabel].push(device);
    return acc;
  }, {});

  return (
    <div className={styles.groupList}>
      {Object.entries(groupedDevices).map(([areaLabel, areaDevices]) => (
        <div key={areaLabel} className={styles.groupSection}>
          <div className={styles.groupHeader}>
            <div className={styles.groupTitle}>{areaLabel}</div>
            <Checkbox
              checked={areaDevices.length > 0 && areaDevices.every((device) => selectedIds.includes(device.did))}
              indeterminate={areaDevices.some((device) => selectedIds.includes(device.did)) && !areaDevices.every((device) => selectedIds.includes(device.did))}
              onChange={(event) => onToggleSelectMany?.(areaDevices.map((device) => device.did), event.target.checked)}
            >
              {t('deviceManage.selectArea')}
            </Checkbox>
          </div>
          <div className={styles.deviceGrid}>
            {areaDevices.map((device) => (
              <DeviceCard
                key={device.did}
                device={device}
                selected={selectedIds.includes(device.did)}
                onSelectChange={onToggleSelect}
                onDelete={onDeleteDevice}
                onRestore={onRestoreDevice}
                actionType={actionType}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceList;
