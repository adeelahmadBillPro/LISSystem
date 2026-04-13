import { useState, useRef } from 'react'

/**
 * Floating screen recorder — records app demo and lets user download / share to social media.
 * Uses browser MediaRecorder + getDisplayMedia API.
 * On mobile: tries Web Share API so user can post directly to WhatsApp / Instagram etc.
 */
export default function ScreenRecorder() {
  const [phase, setPhase] = useState('idle')  // idle | open | recording | done
  const [seconds, setSeconds] = useState(0)
  const [videoBlob, setVideoBlob] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const dateTag = () => new Date().toISOString().slice(0, 10)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, displaySurface: 'browser' },
        audio: true,
      })
      streamRef.current = stream
      chunksRef.current = []

      // Pick best supported mimeType
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = () => {
        clearInterval(timerRef.current)
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setVideoBlob(blob)
        setVideoUrl(url)
        setPhase('done')
      }

      mr.start(500)
      setPhase('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)

      // If user clicks "Stop sharing" in browser chrome
      stream.getVideoTracks()[0].onended = () => stopRecording()

    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        alert('Screen recording is not supported in this browser.')
      }
      setPhase('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const downloadVideo = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `LabPro-Demo-${dateTag()}.webm`
    a.click()
  }

  const shareVideo = async () => {
    if (!videoBlob) return
    const fileName = `LabPro-Demo-${dateTag()}.webm`
    const file = new File([videoBlob], fileName, { type: 'video/webm' })

    // Try native share (works great on mobile — opens WhatsApp, Instagram, etc.)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'LabPro LIS — Lab Information System',
          text: 'Check out LabPro — Complete Lab Management System. Samples, reports, billing, WhatsApp delivery and more.',
        })
        return
      } catch (err) {
        if (err.name === 'AbortError') return  // user cancelled
      }
    }

    // Fallback: just download
    downloadVideo()
  }

  const discard = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoBlob(null)
    setVideoUrl(null)
    setSeconds(0)
    setPhase('idle')
  }

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-[9999] print:hidden flex flex-col items-end gap-2">

      {/* Recording indicator pill */}
      {phase === 'recording' && (
        <div className="flex items-center gap-2 bg-white border border-red-200 rounded-full px-4 py-2 shadow-xl text-sm font-medium text-red-600 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
          REC {fmt(seconds)}
          <button
            onClick={stopRecording}
            className="ml-1 text-xs bg-red-600 text-white px-2.5 py-1 rounded-full hover:bg-red-700 transition-colors font-semibold">
            Stop
          </button>
        </div>
      )}

      {/* Done — download / share panel */}
      {phase === 'done' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 w-72 animate-scaleIn">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-sm">🎬 Recording Done!</h3>
            <button onClick={discard} className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded hover:bg-slate-100">✕ Discard</button>
          </div>

          {/* Video preview */}
          {videoUrl && (
            <video src={videoUrl} controls className="w-full rounded-xl mb-3 max-h-40 bg-slate-900" />
          )}

          <div className="text-xs text-slate-500 mb-3 text-center">
            Duration: <span className="font-semibold text-slate-700">{fmt(seconds)}</span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Share button — native share on mobile, download on desktop */}
            <button
              onClick={shareVideo}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2">
              <span>📤</span>
              Share / Send to Friends
            </button>

            <button
              onClick={downloadVideo}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <span>⬇️</span>
              Download .webm
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-tight">
            Tip: .webm works on all major platforms.<br />
            For Instagram/TikTok, convert to .mp4 using a free tool.
          </p>
        </div>
      )}

      {/* Open panel */}
      {phase === 'open' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 w-72 animate-scaleIn">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 text-sm">🎬 Screen Recorder</h3>
            <button onClick={() => setPhase('idle')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Record a demo of LabPro to share with friends or post on social media.
            Video saves as a <strong>.webm</strong> file you can download or share directly.
          </p>
          <button
            onClick={startRecording}
            className="w-full py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-500/25 active:scale-[0.98] flex items-center justify-center gap-2">
            <span>🔴</span>
            Start Recording
          </button>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            A dialog will ask which screen or window to record
          </p>
        </div>
      )}

      {/* Floating camera button */}
      {(phase === 'idle' || phase === 'open') && (
        <button
          onClick={() => setPhase(p => p === 'open' ? 'idle' : 'open')}
          className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center text-lg transition-all active:scale-95 ${
            phase === 'open'
              ? 'bg-slate-700 text-white rotate-45'
              : 'bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white'
          }`}
          title="Screen Recorder">
          {phase === 'open' ? '✕' : '🎬'}
        </button>
      )}
    </div>
  )
}
