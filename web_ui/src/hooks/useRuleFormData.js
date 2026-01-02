/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import { useMemo } from 'react';
import { formDataUtils } from '@/utils/ruleFormUtils';

/**
 * Hook for processing rule form data conversion
 * 处理规则表单数据转换的Hook
 *
 * @param {Object} rule - Rule data from backend
 * @returns {Object} Formatted data for form
 */
export const useRuleFormData = (rule) => {
  return useMemo(() => {
    if (!rule) {
      return {
        name: '',
        cameras: [],
        ha_devices: [],
        condition: '',
        ai_recommend_execute_type: 'static',
        ai_recommend_action_descriptions: [],
        ai_recommend_actions: [],
        automation_actions: [],
        notify: null,
        filter: null,
        mcp_list: [],
      };
    }

    const formData = {
      name: rule.name || '',
      cameras: rule.cameras || [],
      ha_devices: rule.ha_devices || [],
      condition: rule.condition || '',
      ai_recommend_execute_type: rule.execute_info?.ai_recommend_execute_type || 'static',
      ai_recommend_action_descriptions: rule.execute_info?.ai_recommend_action_descriptions || [],
      ai_recommend_actions: rule.execute_info?.ai_recommend_actions || [],
      automation_actions: rule.execute_info?.automation_actions || [],
      notify: rule.execute_info?.notify || null,
      filter: rule.filter || null,
      mcp_list: rule.execute_info?.mcp_list || [],
    };

    return formData;
  }, [rule]);
};

/**
 * Convert form data to backend format
 * 将表单数据转换为后端格式
 *
 * @param {Object} formData - Form data
 * @returns {Object} Backend format data
 */
export const convertFormDataToBackend = (formData) => {
  const {
    name,
    cameras,
    ha_devices,
    condition,
    ai_recommend_execute_type,
    ai_recommend_action_descriptions,
    ai_recommend_actions,
    automation_actions,
    notify,
    filter,
    mcp_list,
    enabled,
  } = formData;

  const filterData = filter ? formDataUtils.toSubmitFormat(filter) : null;

  const camera_dids = Array.isArray(cameras)
    ? cameras.map(camera => typeof camera === 'object' ? (camera.did || camera) : camera)
    : [];

  const ha_device_ids = Array.isArray(ha_devices) ? ha_devices : [];

  const mcp_list_ids = mcp_list?.length > 0 ? mcp_list.map(mcp => mcp?.client_id) : [];

  const backendData = {
    name,
    cameras: camera_dids,
    ha_devices: ha_device_ids,
    condition,
    execute_info: {
      ai_recommend_execute_type: ai_recommend_execute_type || 'static',
      ai_recommend_action_descriptions: ai_recommend_action_descriptions || [],
      ai_recommend_actions: ai_recommend_actions || [],
      automation_actions: automation_actions || [],
      mcp_list: mcp_list_ids || [],
      ...(notify && notify.content ? { notify } : {}),
    },
    filter: filterData,
  };

  if (enabled !== undefined) {
    backendData.enabled = enabled;
  }

  return backendData;
};

/**
 * Convert backend data to form format
 * 将后端数据转换为表单格式
 *
 * @param {Object} backendData - Backend data
 * @returns {Object} Form format data
 */
export const convertBackendToFormData = (backendData) => {
  if (!backendData) {
    return null;
  }

  return {
    name: backendData.name || '',
    cameras: backendData.cameras || [],
    ha_devices: backendData.ha_devices || [],
    condition: backendData.condition || '',
    ai_recommend_execute_type: backendData.execute_info?.ai_recommend_execute_type || 'static',
    ai_recommend_action_descriptions: backendData.execute_info?.ai_recommend_action_descriptions || [],
    ai_recommend_actions: backendData.execute_info?.ai_recommend_actions || [],
    automation_actions: backendData.execute_info?.automation_actions || [],
    notify: backendData.execute_info?.notify || null,
    filter: backendData.filter ? formDataUtils.toFormFormat(backendData.filter) : null,
    mcp_list: backendData.execute_info?.mcp_list || [],
    enabled: backendData.enabled,
  };
};

