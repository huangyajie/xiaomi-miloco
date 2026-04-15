/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components';
import styles from './index.module.less'

/**
 * VideoModal Component - Video playback modal with canvas content synchronization
 * 视频放大播放Modal组件 - 带有canvas内容同步的视频播放模态框
 *
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether modal is visible
 * @param {Function} props.onClose - Close callback function
 * @param {Object} props.sourceCanvasRef - Source canvas ref from VideoPlayer
 * @param {Object} [props.deviceInfo={}] - Device information object
 * @param {number} [props.channelCount=1] - Number of channels
 * @param {number} [props.currentChannel=0] - Current channel number
 * @param {Function} props.onChannelChange - Channel change callback function
 * @returns {JSX.Element} Video modal component
 */
const VideoModal = ({
  visible,
  onClose,
  sourceCanvasRef,
  deviceInfo = {},
  channelCount = 1,
  currentChannel = 0,
  onChannelChange
}) => {
  const modalCanvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const { t } = useTranslation()
  const modalCanvasSize = { width: 1600, height: 900 }

  // copy canvas content to canvas in Modal
  const copyCanvasContent = useCallback(() => {
    if (!sourceCanvasRef?.current || !modalCanvasRef.current || !visible) {
      return
    }

    try {
      const sourceCanvas = sourceCanvasRef.current
      const modalCanvas = modalCanvasRef.current
      const modalCtx = modalCanvas.getContext('2d')
      const sourceWidth = sourceCanvas.width || 1
      const sourceHeight = sourceCanvas.height || 1
      const sourceRatio = sourceWidth / sourceHeight
      const targetRatio = modalCanvasSize.width / modalCanvasSize.height

      if (modalCanvas.width !== modalCanvasSize.width || modalCanvas.height !== modalCanvasSize.height) {
        modalCanvas.width = modalCanvasSize.width
        modalCanvas.height = modalCanvasSize.height
      }

      if (sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        modalCtx.fillStyle = '#000'
        modalCtx.fillRect(0, 0, modalCanvasSize.width, modalCanvasSize.height)

        let drawWidth = modalCanvasSize.width
        let drawHeight = modalCanvasSize.height
        let offsetX = 0
        let offsetY = 0

        if (sourceRatio > targetRatio) {
          drawHeight = modalCanvasSize.width / sourceRatio
          offsetY = (modalCanvasSize.height - drawHeight) / 2
        } else {
          drawWidth = modalCanvasSize.height * sourceRatio
          offsetX = (modalCanvasSize.width - drawWidth) / 2
        }

        modalCtx.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight)
      }

      if (visible) {
        animationFrameRef.current = requestAnimationFrame(copyCanvasContent)
      }
    } catch {
      if (visible) {
        setTimeout(() => copyCanvasContent(), 100)
      }
    }
  }, [modalCanvasSize.height, modalCanvasSize.width, visible, sourceCanvasRef])

  // start/stop canvas content synchronization
  useEffect(() => {
    if (visible && sourceCanvasRef?.current && modalCanvasRef.current) {
      copyCanvasContent()
    } else if (visible) {
      const timer = setTimeout(() => {
        if (modalCanvasRef.current && sourceCanvasRef?.current) {
          copyCanvasContent()
        }
      }, 100)
      return () => clearTimeout(timer)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [visible, copyCanvasContent, sourceCanvasRef])

  // ensure Modal canvas DOM is rendered
  useLayoutEffect(() => {
    if (visible && modalCanvasRef.current && sourceCanvasRef?.current) {
      copyCanvasContent()
    }
  }, [visible, copyCanvasContent, sourceCanvasRef])

  const handleChannelChange = useCallback(() => {
    if (channelCount > 1 && onChannelChange) {
      onChannelChange()
    }
  }, [channelCount, onChannelChange])

  const handleClose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    onClose && onClose()
  }, [onClose])

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      style={{
        maxWidth: '92vw',
        top: '20px',
        padding: 0,

      }}
      bodyStyle={{
        padding: 0,
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
      destroyOnClose={true}
      closable={false}
      maskClosable={true}
      centered={true}
      styles={{
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
      }}
      className={styles.contentModal}
      width="min(92vw, 1400px)"
    >
      <div className={styles.videoModalContainer}>
        <div className={styles.videoArea}>
          <canvas
            ref={modalCanvasRef}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              background: '#000'
            }}
          />
        </div>

        <div className={styles.topBar}>
          <div className={styles.deviceInfo}>
            <span className={styles.deviceName}>
              {deviceInfo.name || t('instant.deviceList.noDevice')}
            </span>
          </div>
          <div className={styles.controls}>
            <div
              className={styles.controlButton}
              onClick={handleClose}
              title={t('common.close')}
            >
              <Icon
                name="close"
                width={16}
                height={16}
                style={{ color: '#fff' }}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default VideoModal
