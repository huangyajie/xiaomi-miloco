/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components';
import styles from './index.module.less';

/**
 * DeviceCard Component - Device card component
 * 设备卡片组件
 *
 * @param {Object} device - The device data to display
 * @returns {JSX.Element} Device card component
 */
const DeviceCard = ({ device }) => {
  const { t } = useTranslation();
  const { name, icon, room_name, home_name, online } = device;
  const displayRoomName = room_name || t('deviceManage.defaultRoom');

  const StatusView = ({device}) => {
    const {  is_set_pincode } = device;
    if(is_set_pincode > 0){
      return <Icon name="lockLittle" size={18} />
    }
    return null
  }


  return (
    <Card className={`${styles.deviceCard} ${!online ? styles.offline : ''}`} contentClassName={styles.deviceCardContent}>
      <div className={styles.deviceIcon}>
        {icon ? (
          <img src={icon} alt={name} className={styles.deviceImage} />
        ) : (
          <div className={styles.defaultIcon}>{icon}</div>
        )}

      </div>
            <div className={styles.deviceInfo}>
              <div className={styles.deviceName}>{name}</div>
              <div className={styles.deviceDetails}>
                {home_name ? `${home_name} | ${displayRoomName}` : displayRoomName}
              </div>
            </div>      <StatusView device={device} />
    </Card>
  );
};

export default DeviceCard;
