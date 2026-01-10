/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Spin, message } from 'antd'
import { useTranslation } from 'react-i18next';
import { isFirefox, sleep } from '@/utils/util';
import DefaultCameraBg from '@/assets/images/default-camera-bg.png'

/**
 * Detect video codec from binary data
 * 从二进制数据中检测视频编码格式
 *
 * @param {Uint8Array} data - Binary video data
 * @returns {string} Detected codec type ('h264', 'h265', or 'unknown')
 */
const detectCodec = (data) => {
  let i = 0;
  while (i < data.length - 6) {
    if (
      data[i] === 0x00 && data[i + 1] === 0x00 &&
      ((data[i + 2] === 0x00 && data[i + 3] === 0x01) || data[i + 2] === 0x01)
    ) {
      const nalStart = data[i + 2] === 0x01 ? i + 3 : i + 4;
      const byte = data[nalStart];
      const h264Type = byte & 0x1f;
      // H.265 Type is bits 1-6. Bit 0 must be 0 for LayerId=0 (Base layer).
      // Also Bit 7 (Forbidden) must be 0.
      const isH265Candidate = (byte & 0x81) === 0;
      const h265Type = (byte >> 1) & 0x3f;

      if ([5, 7, 8].includes(h264Type)) {
          console.log(`Detected H.264: Byte=${byte.toString(16)}, Type=${h264Type}`);
          return 'h264';
      }
      if (isH265Candidate && [32, 33, 34, 19, 20].includes(h265Type)) {
          console.log(`Detected H.265: Byte=${byte.toString(16)}, Type=${h265Type}`);
          return 'h265';
      }
    }
    i++;
  }
  return 'unknown';
}

/**
 * VideoPlayer Component - WebCodecs-based video player for camera streams
 * 视频播放器组件 - 基于WebCodecs的摄像头流视频播放器
 *
 * @param {Object} props - Component props
 * @param {string} [props.codec='avc1.42E01E'] - Video codec format
 * @param {string} [props.poster] - Poster image URL
 * @param {Object} [props.style] - Custom style object
 * @param {string} props.cameraId - Camera device ID
 * @param {number} [props.channel=0] - Camera channel number
 * @param {Function} [props.onCanvasRef] - Canvas ref callback function
 * @returns {JSX.Element} Video player component
 */
const VideoPlayer = ({ codec = 'avc1.42E01E', poster, style, cameraId, channel, onCanvasRef, onPlay }) => {
  const { t } = useTranslation();
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const decoderRef = useRef(null)
  const detectedCodecRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [show, setShow] = useState(false)
  const [isSupported, setIsSupported] = useState(null)

  // detect WebCodecs support
  useEffect(() => {
    const checkSupport = () => {
      console.log('Current environment:', {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        location: window.location.href,
        hasWindow: typeof window !== 'undefined',
        windowType: typeof window
      })

      const supported = (
        typeof window !== 'undefined' &&
        'VideoDecoder' in window &&
        'VideoFrame' in window &&
        'ImageBitmap' in window
      )

      console.log('WebCodecs API detection:', {
        hasWindow: typeof window !== 'undefined',
        hasVideoDecoder: typeof window !== 'undefined' && 'VideoDecoder' in window,
        hasVideoFrame: typeof window !== 'undefined' && 'VideoFrame' in window,
        hasImageBitmap: typeof window !== 'undefined' && 'ImageBitmap' in window,
        supported
      })

      if (!supported) {
        console.warn('⚠️ WebCodecs not supported, possible reasons:')
        console.warn('1. WebCodecs is not supported in this browser (Chrome 94+, Edge 94+)')
        console.warn('2. Vite hot update environment limit, please try to force refresh the page (F5)')
        console.warn('3. WebCodecs needs to be enabled in chrome://flags')
        console.warn('4. Needs HTTPS or localhost environment')
      }

      setIsSupported(supported)
      return supported
    }

    checkSupport()
  }, [])

  /**
   * Helper to convert byte to hex string
   */
  const toHex = (v) => {
    return v.toString(16).padStart(2, '0').toUpperCase();
  }

  /**
   * Check if the data is a key frame
   * @param {Uint8Array} data - Binary video data
   * @param {string} codec - Video codec format
   * @returns {boolean} Whether the data is a key frame
   */
  const isKeyFrame = (data, codec) => {
    if (codec.startsWith('avc1') || codec.startsWith('h264')) {
      // H264
      let i = 0;
      while (i < data.length - 4) {
        if (
          data[i] === 0x00 && data[i + 1] === 0x00 &&
          ((data[i + 2] === 0x00 && data[i + 3] === 0x01) || data[i + 2] === 0x01)
        ) {
          const nalUnitType = data[i + 2] === 0x01 ? data[i + 3] & 0x1f : data[i + 4] & 0x1f;
          // SPS(7), PPS(8), IDR(5) are all critical for decoding start
          if (nalUnitType === 5 || nalUnitType === 7 || nalUnitType === 8) {
            return true;
          }
        }
        i++;
      }
      return false;
    } else if (codec.startsWith('hvc1') || codec.startsWith('hev1') || codec.startsWith('h265')) {
      // H265/HEVC
      let i = 0;
      while (i < data.length - 6) {
        if (
          data[i] === 0x00 && data[i + 1] === 0x00 &&
          ((data[i + 2] === 0x00 && data[i + 3] === 0x01) || data[i + 2] === 0x01)
        ) {
          const nalStart = data[i + 2] === 0x01 ? i + 3 : i + 4;
          const nalUnitType = (data[nalStart] >> 1) & 0x3f;
          if ([16, 17, 18, 19, 20].includes(nalUnitType)) {return true;}
        }
        i++;
      }
      return false;
    }
    // default to handle key frame
    return true;
  }

  useEffect(() => {
    if (onCanvasRef && canvasRef.current) {
      onCanvasRef(canvasRef)
    }
  }, [onCanvasRef, show])

  useEffect(() => {
    /**
     * Parse SPS to get H.264 codec string
     * @param {Uint8Array} data
     * @returns {string|null}
     */
    const getH264CodecString = (data) => {
      let i = 0;
      while (i < data.length - 4) {
        if (
          data[i] === 0x00 && data[i + 1] === 0x00 &&
          ((data[i + 2] === 0x00 && data[i + 3] === 0x01) || data[i + 2] === 0x01)
        ) {
          const nalStart = data[i + 2] === 0x01 ? i + 3 : i + 4;
          const nalUnitType = data[nalStart] & 0x1f;
          if (nalUnitType === 7) { // SPS
            const profileIdc = data[nalStart + 1];
            const constraintSet = data[nalStart + 2];
            const levelIdc = data[nalStart + 3];
            return `avc1.${toHex(profileIdc)}${toHex(constraintSet)}${toHex(levelIdc)}`;
          }
        }
        i++;
      }
      return null;
    }

    const init = async () => {
      if (!cameraId || isSupported === null) {return} // wait for support detection to complete

      if (isFirefox()) {
        setError(t('instant.deviceList.browserNotSupport'))
        message.error(t('instant.deviceList.browserNotSupport'))
        onPlay && onPlay()
        return
      }

      if (!isSupported) {
        setError(t('instant.deviceList.deviceNotSupport'))
        message.error(t('instant.deviceList.deviceNotSupport'))
        onPlay && onPlay()
        return
      }

      if (wsRef.current) {
        try {
          wsRef.current.close && wsRef.current.close();
        } catch (e) {
          console.error('Close WebSocket exception:', e);
        }
        wsRef.current = null;
      }
      if (decoderRef.current) {
        try {
          decoderRef.current.close && decoderRef.current.close();
        } catch (e) {
          if (e.name !== 'InvalidStateError') {
            console.error('Close VideoDecoder exception:', e);
          }
        }
        decoderRef.current = null;
      }
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${window.location.host}${import.meta.env.VITE_API_BASE || ''}/api/miot/ws/video_stream?camera_id=${encodeURIComponent(cameraId)}&channel=${encodeURIComponent(channel)}`
      setLoading(true)
      setError(null)
      setShow(false)
      let ready = false
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      await sleep(1000)

      // here assume wsUrl pushes H264 AnnexB format
      wsRef.current = new window.WebSocket(wsUrl)
      wsRef.current.binaryType = 'arraybuffer'

      // connection failed handling
      wsRef.current.onerror = (err) => {
        console.log('video player: WebSocket connection failed', err)
        setError(t('instant.deviceList.deviceConnectFailed'))
        message.error(t('instant.deviceList.deviceConnectFailed'))
        wsRef.current && wsRef.current?.close?.()
        onPlay && onPlay()
      }
      // connection closed handling
      wsRef.current.onclose = (event) => {
        console.log('video player: WebSocket connection closed')
        if (!error) {
          setError(t('instant.deviceList.deviceConnectClosed'))
          // message.error(t('instant.deviceList.deviceConnectClosed'))
        }
        const { reason = '' } = event;
        if (reason !== 'close_by_user') {
          onPlay && onPlay()
        }
      }

      decoderRef.current = new window.VideoDecoder({
        output: frame => {
          createImageBitmap(frame).then(bitmap => {
            canvas.width = frame.codedWidth
            canvas.height = frame.codedHeight
            ctx.drawImage(bitmap, 0, 0)
            frame.close()
            bitmap.close && bitmap.close()
            if (!ready) {
              setLoading(false)
              setShow(true)
              if (onCanvasRef && canvasRef.current) {
                onCanvasRef(canvasRef)
              }
              // handleReady()
              ready = true
            }
          })
        },
        error: (e) => {
          console.error('VideoDecoder error:', e);
          setError(t('instant.deviceList.deviceDecodeFailed'))
          message.error(t('instant.deviceList.deviceDecodeFailed'))
        }
      })
      decoderRef.current.configure({
        codec,
        hardwareAcceleration: 'prefer-hardware',
      })

      let lastConfiguredCodec = codec;

      wsRef.current.onmessage = e => {
        if (e.data instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(e.data);
          let currentCodec = detectedCodecRef.current;

          if (!currentCodec) {
            const detected = detectCodec(uint8);
            if (detected !== 'unknown') {
              console.log('Initial codec detection:', detected);
              if (detected === 'h264') {
                const spsCodec = getH264CodecString(uint8);
                currentCodec = spsCodec || 'avc1.640028';
              } else {
                currentCodec = 'hev1.1.6.L93.B0'; // Use hev1 for Annex-B
              }
              detectedCodecRef.current = currentCodec;
            }
          }

          // Try to update H.264 codec from SPS if it was using default or we find a new one
          if (currentCodec && currentCodec.startsWith('avc1')) {
             const spsCodec = getH264CodecString(uint8);
             if (spsCodec && spsCodec !== currentCodec) {
                console.log(`Updating H.264 codec from SPS: ${currentCodec} -> ${spsCodec}`);
                currentCodec = spsCodec;
                detectedCodecRef.current = currentCodec;
             }
          }

          const useCodec = currentCodec || codec;

          // Reconfigure if codec changed
          if (useCodec !== lastConfiguredCodec && decoderRef.current && decoderRef.current.state !== 'closed') {
            try {
              console.log('Configuring decoder with codec:', useCodec);
              decoderRef.current.configure({
                codec: useCodec,
                hardwareAcceleration: 'prefer-hardware',
              });
              lastConfiguredCodec = useCodec;
              decoderRef.current._waitForKeyFrame = true; // Need new keyframe after re-config
            } catch (configError) {
              console.error('Decoder configuration failed:', configError);
            }
          }

          if (decoderRef.current._waitForKeyFrame === undefined) {
            decoderRef.current._waitForKeyFrame = true;
          }
          const isKey = isKeyFrame(uint8, useCodec);

          if (decoderRef.current._waitForKeyFrame) {
            if (!isKey) {
              return;
            } else {
              console.log('Keyframe found, starting decode');
              decoderRef.current._waitForKeyFrame = false;
            }
          }

          try {
            decoderRef.current.decode(new EncodedVideoChunk({
              type: isKey ? 'key' : 'delta',
              timestamp: performance.now(),
              data: uint8
            }))
          } catch (err) {
            console.error('Decode error:', err);
            setError(t('instant.deviceList.deviceDecodeFailed'))
          }
        }
      }
    }
    init()
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close && wsRef.current.close(1000, 'close_by_user');
        } catch (e) {
          console.error('Close WebSocket exception:', e);
        }
        wsRef.current = null;
      }
      if (decoderRef.current) {
        try {
          decoderRef.current.close && decoderRef.current.close();
        } catch (e) {
          if (e.name !== 'InvalidStateError') {
            console.error('Close VideoDecoder exception:', e);
          }
        }
        decoderRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codec, isSupported, cameraId, channel, onCanvasRef, t])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {loading && (
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.1)',
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8
        }}>
           <img
            src={DefaultCameraBg}
            alt="default-camera-bg"
            style={{ width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 8,
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: -1,
            }}
          />
          <Spin tip={t('common.loading')} />
        </div>
      )}
      {!show && poster && (
        <img src={poster} alt="poster" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover',
          opacity: show ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(.4,0,.2,1)'
        }}
      />
    </div>
  )
}

export default VideoPlayer
