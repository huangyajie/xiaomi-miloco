/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useState } from 'react'
import { Button, Form, Input, message, Modal, Select, Switch } from 'antd'
import { useTranslation } from 'react-i18next';
import { PlusOutlined } from '@ant-design/icons'
import { Icon } from '@/components';
import { addRtspCamera, deleteRtspCamera, getRtspCameraList, updateRtspCamera } from '@/api';
import DeviceItem from '../DeviceItem'
import { useChatStore } from '@/stores/chatStore'
import styles from './index.module.less'

/**
 * DeviceList Component - List of camera devices with refresh and close functionality
 * 设备列表组件 - 带有刷新和关闭功能的摄像头设备列表
 *
 * @param {Object} props - Component props
 * @param {Array} props.cameraList - Array of camera device objects
 * @param {Function} props.onPlay - Play callback function for device items
 * @param {Array} props.currentPlayingId - Array of currently playing device IDs
 * @param {Function} props.onRefresh - Refresh callback function
 * @param {Function} props.onClose - Close callback function
 * @returns {JSX.Element} Device list component
 */
const DeviceList = ({ cameraList, onPlay, currentPlayingId, onRefresh, onClose }) => {
  const { t } = useTranslation();
  const { isRefreshing } = useChatStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [form] = Form.useForm();

  const handleAddRtsp = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        rtsp_url: values.rtsp_url?.trim() || editingCamera?.rtsp_url || '',
      };
      setSubmitting(true);
      const res = editingCamera
        ? await updateRtspCamera(editingCamera.did, payload)
        : await addRtspCamera(payload);
      if (res?.code === 0) {
        message.success(t('instant.deviceList.saveRtspSuccess'));
        setModalOpen(false);
        setEditingCamera(null);
        form.resetFields();
        onRefresh?.();
      } else {
        message.error(res?.message || t('instant.deviceList.saveRtspFailed'));
      }
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(t('instant.deviceList.saveRtspFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingCamera(null);
    form.setFieldsValue({
      name: '',
      rtsp_url: '',
      transport: 'tcp',
      vendor: '',
      room_name: 'RTSP Cameras',
      home_name: 'Third Party',
      enable_audio: false,
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = async (camera) => {
    let cameraConfig = camera;
    try {
      const res = await getRtspCameraList();
      const matchedCamera = res?.data?.find?.((item) => item.did === camera.did);
      if (matchedCamera) {
        cameraConfig = {
          ...camera,
          ...matchedCamera,
        };
      }
    } catch (error) {
      console.error('failed to load RTSP config for edit', error);
    }

    setEditingCamera(cameraConfig);
    form.setFieldsValue({
      name: cameraConfig.name || '',
      rtsp_url: cameraConfig.rtsp_url || '',
      transport: cameraConfig.transport || 'tcp',
      vendor: cameraConfig.vendor || '',
      room_name: cameraConfig.room_name || '',
      home_name: cameraConfig.home_name || '',
      enable_audio: Boolean(cameraConfig.enable_audio),
    });
    setModalOpen(true);
  };

  const handleDeleteRtsp = async (camera) => {
    const res = await deleteRtspCamera(camera.did);
    if (res?.code === 0) {
      message.success(t('common.deleteSuccess'));
      onRefresh?.();
      return;
    }
    message.error(res?.message || t('common.deleteFail'));
  };

  return (
    <div className={styles.deviceListWrap}>
      <div className={styles.titleWrap}>
        <span>{t('instant.deviceList.cameraList')}</span>
        <Button
          size="small"
          className={styles.addButton}
          icon={<PlusOutlined />}
          onClick={handleOpenAddModal}
        >
          {t('instant.deviceList.rtspButton')}
        </Button>
        <Icon
          name="refresh"
          className={`${styles.update} ${isRefreshing ? styles.rotating : ''}`}
          size={16}
          onClick={() => {
            if(isRefreshing) {return;}
            onRefresh();
          }}
        />
        <Icon name="arrowLeft"
          className={styles.closeIcon}
          size={16} onClick={() => {
            onClose()
          }} />
      </div>
      <div className={styles.listWrap}>
        {cameraList.map(item => (
          <DeviceItem
            key={item.did}
            item={item}
            onPlay={() => onPlay(item)}
            playing={currentPlayingId.includes(item.did)}
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteRtsp}
          />
        ))}
      </div>
      <Modal
        title={editingCamera ? t('instant.deviceList.editRtspCamera') : t('instant.deviceList.addRtspCamera')}
        open={modalOpen}
        onCancel={() => {
          if (submitting) return;
          setModalOpen(false);
          setEditingCamera(null);
        }}
        onOk={handleAddRtsp}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            transport: 'tcp',
            enable_audio: false,
            home_name: '第三方摄像头',
            room_name: '默认分组',
          }}
        >
          <Form.Item
            name="name"
            label={t('instant.deviceList.cameraName')}
            rules={[{ required: true, message: t('instant.deviceList.pleaseEnterCameraName') }]}
          >
            <Input placeholder={t('instant.deviceList.cameraNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="rtsp_url"
            label={t('instant.deviceList.rtspUrl')}
            rules={[
              {
                validator: (_, value) => {
                  if (value?.trim() || editingCamera?.rtsp_url) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('instant.deviceList.pleaseEnterRtspUrl')));
                }
              }
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder={editingCamera ? t('instant.deviceList.keepRtspUrlPlaceholder') : t('instant.deviceList.rtspUrlPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="transport" label={t('instant.deviceList.transport')}>
            <Select
              options={[
                { value: 'tcp', label: 'TCP' },
                { value: 'udp', label: 'UDP' },
              ]}
            />
          </Form.Item>
          <Form.Item name="vendor" label={t('instant.deviceList.vendor')}>
            <Input placeholder={t('instant.deviceList.vendorPlaceholder')} />
          </Form.Item>
          <Form.Item name="room_name" label={t('instant.deviceList.roomName')}>
            <Input placeholder={t('instant.deviceList.roomNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="home_name" label={t('instant.deviceList.groupName')}>
            <Input placeholder={t('instant.deviceList.groupNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="enable_audio" label={t('instant.deviceList.enableAudio')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DeviceList
