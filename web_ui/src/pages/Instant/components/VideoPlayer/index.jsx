/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Spin, message } from 'antd'
import { useTranslation } from 'react-i18next';
import { isFirefox, sleep } from '@/utils/util';
import DefaultCameraBg from '@/assets/images/default-camera-bg.png'
import JMuxer from 'jmuxer'

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
      const h264Type = data[nalStart] & 0x1f;
      const h265Type = (data[nalStart] >> 1) & 0x3f;
      if ([5, 7, 8].includes(h264Type)) {return 'h264';}
      if ([32, 33, 34, 19, 20].includes(h265Type)) {return 'h265';}
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
  const videoRef = useRef(null)
  const wsRef = useRef(null)
  const decoderRef = useRef(null)
  const currentCodecRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [show, setShow] = useState(false)
  const [isSupported, setIsSupported] = useState(null)
  const [autoCodec, setAutoCodec] = useState(null);
  const currentCodecTypeRef = useRef(null)
  const lastSPSRef = useRef(null)
  const lastPPSRef = useRef(null)
  const jmuxerRef = useRef(null)
  const rafRef = useRef(null)
  const useJMuxerRef = useRef(false)

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
          return nalUnitType === 5;
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

  const splitAnnexB = (buf) => {
    const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    const units = []
    let i = 0
    while (i < data.length - 3) {
      if (data[i] === 0x00 && data[i + 1] === 0x00 && ((data[i + 2] === 0x01) || (data[i + 2] === 0x00 && data[i + 3] === 0x01))) {
        const sync3 = data[i + 2] === 0x01
        const start = i + (sync3 ? 3 : 4)
        let j = start
        while (j < data.length - 3) {
          if (data[j] === 0x00 && data[j + 1] === 0x00 && ((data[j + 2] === 0x01) || (data[j + 2] === 0x00 && data[j + 3] === 0x01))) {
            break
          }
          j++
        }
        units.push(data.slice(start, j))
        i = j
      } else {
        i++
      }
    }
    return units
  }

  const getH264NalType = (nal) => (nal[0] & 0x1f)
  const isH264 = (codecStr) => String(codecStr || '').toLowerCase().startsWith('avc1') || String(codecStr || '').toLowerCase().startsWith('h264')
  const startCode4 = new Uint8Array([0,0,0,1])

  useEffect(() => {
    if (onCanvasRef && canvasRef.current) {
      onCanvasRef(canvasRef)
    }
  }, [onCanvasRef, show])

  useEffect(() => {
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

      const drawBitmapCover = (bitmap) => {
        const dpr = window.devicePixelRatio || 1
        const cw = canvas.clientWidth || bitmap.width
        const ch = canvas.clientHeight || bitmap.height
        const bw = bitmap.width
        const bh = bitmap.height
        canvas.width = Math.floor(cw * dpr)
        canvas.height = Math.floor(ch * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cw, ch)
        const scale = Math.max(cw / bw, ch / bh)
        const dw = bw * scale
        const dh = bh * scale
        const dx = (cw - dw) / 2
        const dy = (ch - dh) / 2
        ctx.drawImage(bitmap, dx, dy, dw, dh)
      }

      const mapCodecToType = (str) => {
        const s = String(str || '').toLowerCase()
        if (s.startsWith('avc1') || s.startsWith('h264')) { return 'h264' }
        if (s.startsWith('hvc1') || s.startsWith('hev1') || s.startsWith('h265')) { return 'h265' }
        return null
      }

      const createDecoder = (cfgCodec) => {
        if (decoderRef.current) {
          try { decoderRef.current.flush?.() } catch (e) { console.debug('decoder flush error', e) }
          try { decoderRef.current.close?.() } catch (e) { console.debug('decoder close error', e) }
        }
        decoderRef.current = new window.VideoDecoder({
          output: frame => {
            createImageBitmap(frame)
              .then(bitmap => {
                drawBitmapCover(bitmap)
                frame.close()
                bitmap.close && bitmap.close()
                if (!ready) {
                  setLoading(false)
                  setShow(true)
                  if (onCanvasRef && canvasRef.current) {
                    onCanvasRef(canvasRef)
                  }
                  ready = true
                }
              })
              .catch((e) => { try { frame.close() } catch (err) { console.debug('frame close error', err, e) } })
          },
          error: () => {
            setError(t('instant.deviceList.deviceDecodeFailed'))
            message.error(t('instant.deviceList.deviceDecodeFailed'))
          }
        })
        try {
          decoderRef.current.configure({
            codec: cfgCodec,
            hardwareAcceleration: 'prefer-hardware',
          })
          currentCodecRef.current = cfgCodec
          currentCodecTypeRef.current = mapCodecToType(cfgCodec)
          decoderRef.current._waitForKeyFrame = true
        } catch (e) {
          console.error('Decoder configure failed:', e)
        }
      }

      createDecoder(codec)

      const stopJMuxerLoop = () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      }

      const startJMuxer = () => {
        if (jmuxerRef.current) {
          try { jmuxerRef.current.destroy?.() } catch (e) { console.debug('jmuxer destroy error', e) }
          jmuxerRef.current = null
        }
        useJMuxerRef.current = true
        jmuxerRef.current = new JMuxer({
          node: videoRef.current,
          mode: 'video',
          fps: 25,
          clearBuffer: true,
        })
        try { videoRef.current.muted = true; videoRef.current.playsInline = true; videoRef.current.play?.().catch((e)=>{ console.debug('video play failed', e) }) } catch (e) { console.debug('video property set failed', e) }
        const loop = () => {
          try {
            if (videoRef.current && canvasRef.current) {
              const canvas = canvasRef.current
              const ctx = canvas.getContext('2d')
              const dpr = window.devicePixelRatio || 1
              const cw = canvas.clientWidth || videoRef.current.videoWidth || 0
              const ch = canvas.clientHeight || videoRef.current.videoHeight || 0
              const bw = videoRef.current.videoWidth || 0
              const bh = videoRef.current.videoHeight || 0
              if (bw > 0 && bh > 0 && cw > 0 && ch > 0) {
                canvas.width = Math.floor(cw * dpr)
                canvas.height = Math.floor(ch * dpr)
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
                ctx.clearRect(0, 0, cw, ch)
                const scale = Math.max(cw / bw, ch / bh)
                const dw = bw * scale
                const dh = bh * scale
                const dx = (cw - dw) / 2
                const dy = (ch - dh) / 2
                ctx.drawImage(videoRef.current, dx, dy, dw, dh)
                if (!ready) {
                  setLoading(false)
                  setShow(true)
                  if (onCanvasRef && canvasRef.current) { onCanvasRef(canvasRef) }
                  ready = true
                }
              }
            }
          } finally {
            rafRef.current = requestAnimationFrame(loop)
          }
        }
        stopJMuxerLoop()
        rafRef.current = requestAnimationFrame(loop)
      }
      wsRef.current.onmessage = e => {
        if (e.data instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(e.data);
          let detectedCodecStr = null;
          let detectedType = null;
          if (!autoCodec) {
            const detected = detectCodec(uint8);
            if (detected !== 'unknown') {
              detectedType = detected;
              detectedCodecStr = detected === 'h264' ? 'avc1.42E01E' : 'hev1.1.6.L93.B0';
              setAutoCodec(detectedCodecStr);
            }
          }
          const useCodec = autoCodec || detectedCodecStr || codec;
          const useType = detectedType || mapCodecToType(useCodec) || mapCodecToType(codec);

          if (useType === 'h264') {
            if (!useJMuxerRef.current) {
              try { decoderRef.current?.close?.() } catch (e) { console.debug('decoder close before jmuxer start', e) }
              startJMuxer()
            }
            // Prepare SPS/PPS injection for IDR frames
            let feedData = uint8
            const nals = splitAnnexB(uint8)
            nals.forEach(nal => {
              const t = getH264NalType(nal)
              if (t === 7) { lastSPSRef.current = nal }
              if (t === 8) { lastPPSRef.current = nal }
            })
            const hasIDR = nals.some(nal => getH264NalType(nal) === 5)
            if (hasIDR && lastSPSRef.current && lastPPSRef.current) {
              const sps = lastSPSRef.current
              const pps = lastPPSRef.current
              const merged = new Uint8Array(startCode4.length + sps.length + startCode4.length + pps.length + uint8.length)
              let off = 0
              merged.set(startCode4, off); off += startCode4.length
              merged.set(sps, off); off += sps.length
              merged.set(startCode4, off); off += startCode4.length
              merged.set(pps, off); off += pps.length
              merged.set(uint8, off)
              feedData = merged
            }
            try { jmuxerRef.current?.feed?.({ video: feedData }) } catch (e) { console.debug('jmuxer feed error', e) }
            return
          }

          if (decoderRef.current._waitForKeyFrame === undefined) {
            decoderRef.current._waitForKeyFrame = true;
          }
          const isKey = isKeyFrame(uint8, useCodec);

          if (decoderRef.current._waitForKeyFrame) {
            if (!isKey) {
              return;
            } else {
              decoderRef.current._waitForKeyFrame = false;
            }
          }
          if (currentCodecTypeRef.current && useType && currentCodecTypeRef.current !== useType) {
            createDecoder(useCodec)
            // wait for next keyframe after reconfigure
            decoderRef.current._waitForKeyFrame = true
            if (!isKey) {
              return
            }
          }

          let chunkData = uint8
          if (isH264(useCodec)) {
            const nals = splitAnnexB(uint8)
            // cache SPS/PPS
            nals.forEach(nal => {
              const t = getH264NalType(nal)
              if (t === 7) { lastSPSRef.current = nal }
              if (t === 8) { lastPPSRef.current = nal }
            })
            // if IDR, ensure SPS/PPS are prepended for decoder init
            const hasIDR = nals.some(nal => getH264NalType(nal) === 5)
            if (hasIDR) {
              const sps = lastSPSRef.current
              const pps = lastPPSRef.current
              if (sps && pps) {
                const totalLen = startCode4.length + sps.length + startCode4.length + pps.length + uint8.length
                const merged = new Uint8Array(totalLen)
                let off = 0
                merged.set(startCode4, off); off += startCode4.length
                merged.set(sps, off); off += sps.length
                merged.set(startCode4, off); off += startCode4.length
                merged.set(pps, off); off += pps.length
                merged.set(uint8, off)
                chunkData = merged
              }
            }
          }
          try {
            decoderRef.current.decode(new EncodedVideoChunk({
              type: isKey ? 'key' : 'delta',
              timestamp: performance.now(),
              data: chunkData
            }))
          } catch (err) {
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
      try { jmuxerRef.current?.destroy?.() } catch (e) { console.debug('jmuxer destroy error on cleanup', e) }
      jmuxerRef.current = null
      useJMuxerRef.current = false
      if (rafRef.current) { try { cancelAnimationFrame(rafRef.current) } catch (e) { console.debug('cancelAnimationFrame error', e) } rafRef.current = null }
    }
  }, [codec, isSupported, cameraId, channel])

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
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
    </div>
  )
}

export default VideoPlayer
