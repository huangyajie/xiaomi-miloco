/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useState } from 'react';
import { Modal, Input, Button, Alert } from 'antd';
import styles from './index.module.less';

/**
 * AuthCodeModal - paste the base64 auth code from the Xiaomi redirect page
 * @param {boolean} props.visible
 * @param {Function} props.onSubmit - called with { code, state } after decode
 * @param {Function} props.onCancel
 * @param {Function} props.t - i18n translation function
 */
const AuthCodeModal = ({ visible, onSubmit, onCancel, t }) => {
  const [payload, setPayload] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const trimmed = payload.trim();
    if (!trimmed) {
      setError(t('authCode.errorEmpty'));
      return;
    }
    let code, state;
    try {
      const decoded = atob(trimmed);
      const data = JSON.parse(decoded);
      code = data.code?.trim();
      state = data.state?.trim();
    } catch {
      setError(t('authCode.errorFormat'));
      return;
    }
    if (!code || !state) {
      setError(t('authCode.errorFormat'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ code, state });
      setPayload('');
    } catch (e) {
      setError(e?.message || t('authCode.errorSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPayload('');
    setError('');
    onCancel();
  };

  return (
    <Modal
      title={<div className={styles.title}>{t('authCode.title')}</div>}
      centered
      open={visible}
      closable={false}
      maskClosable={false}
      footer={null}
      width={560}
      className={styles.authCodeModal}
    >
      <div className={styles.content}>
        <p className={styles.desc}>{t('authCode.desc')}</p>
        <Input.TextArea
          className={styles.input}
          rows={4}
          placeholder={t('authCode.placeholder')}
          value={payload}
          onChange={(e) => { setPayload(e.target.value); setError(''); }}
        />
        {error && <Alert className={styles.alert} type="error" message={error} showIcon />}
        <div className={styles.buttonGroup}>
          <Button onClick={handleCancel}>{t('authCode.cancel')}</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            {t('authCode.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AuthCodeModal;
