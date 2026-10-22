import { useState, useRef, useEffect } from 'react';
import { Mic, Camera, Square, Paperclip, FlaskConical, Trash2 } from 'lucide-react';
import type { Media, Session } from '../domain/types';
import type { DemoApi } from '../services/api';
import { t } from '../i18n';
import { ErrorBox } from './ui';
export function MediaCapture({
  api,
  session,
  onAttach,
}: {
  api: DemoApi;
  session: Session;
  onAttach: (media: Media) => void;
}) {
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [voice, setVoice] = useState('');
  const [photo, setPhoto] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingDuration = useRef(0);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      recordingDuration.current++;
      setSeconds(recordingDuration.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (camera && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camera]);
  const dataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Could not read media.'));
      r.readAsDataURL(blob);
    });
  async function record() {
    try {
      setError('');
      setSample(false);
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          'Microphone recording is unavailable in this browser. You can use a labeled synthetic sample.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = async () => {
        setVoice(await dataUrl(new Blob(chunks.current, { type: r.mimeType })));
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      r.start();
      recordingDuration.current = 0;
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openCamera() {
    try {
      setError('');
      setSample(false);
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Camera capture is unavailable. Attach a photo or use a labeled synthetic sample.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCamera(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setPhoto(c.toDataURL('image/jpeg', 0.8));
    stream.current?.getTracks().forEach((t) => t.stop());
    setCamera(false);
  }
  async function loadFile(f: File) {
    try {
      if (!f.type.startsWith('image/')) throw new Error('Choose an image file.');
      if (f.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
      const bitmap = await createImageBitmap(f);
      const c = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      c.width = bitmap.width * scale;
      c.height = bitmap.height * scale;
      c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
      setPhoto(c.toDataURL('image/jpeg', 0.8));
      bitmap.close();
      setSample(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function attach(kind: 'photo' | 'voice') {
    setBusy(true);
    try {
      const m = await api.upload(session, {
        kind,
        url: kind === 'photo' ? photo : voice,
        name: sample ? 'Synthetic sample' : kind === 'photo' ? 'Event photo' : 'Voice note',
        duration: kind === 'voice' ? seconds : undefined,
        synthetic: sample,
        transcript: transcript || undefined,
      });
      onAttach(m);
      setPhoto('');
      setVoice('');
      setTranscript('');
      setSample(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="capture">
      <div className="capture-buttons">
        <button
          type="button"
          className="subtle-button"
          disabled={busy || camera || !!voice}
          onClick={() =>
            recording ? (recorder.current?.stop(), setRecording(false)) : void record()
          }
        >
          {recording ? <Square size={17} /> : <Mic size={17} />}{' '}
          {recording ? `Stop · ${seconds}s` : t('media.voice')}
        </button>
        <button
          type="button"
          className="subtle-button"
          disabled={recording || busy}
          onClick={() => void openCamera()}
        >
          <Camera size={17} />
          {t('media.camera')}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => file.current?.click()}
          aria-label={t('media.file')}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
          }}
        />
      </div>
      {error && <ErrorBox message={error} />}{' '}
      {camera && (
        <div className="media-preview">
          <video autoPlay muted playsInline ref={video} />
          <button type="button" className="button primary" onClick={capture}>
            {t('media.capture')}
          </button>
          <button
            type="button"
            onClick={() => {
              stream.current?.getTracks().forEach((t) => t.stop());
              setCamera(false);
            }}
          >
            Cancel camera
          </button>
        </div>
      )}
      {(photo || voice) && (
        <div className="media-preview">
          {photo ? (
            <img src={photo} alt={sample ? 'Synthetic sample shift note' : 'Photo preview'} />
          ) : (
            <>
              <audio controls src={voice} />
              <p>Recorded voice note · {seconds}s</p>
            </>
          )}
          {sample && <span className="badge">Synthetic sample</span>}
          {voice && (
            <label>
              Transcript review <small>Optional · kept separate from the recording</small>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type a reviewed transcript, or leave blank"
              />
            </label>
          )}
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void attach(photo ? 'photo' : 'voice')}
            >
              {busy ? 'Attaching…' : t('media.attach')}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setPhoto('');
                setVoice('');
                setTranscript('');
              }}
            >
              <Trash2 size={16} />
              {t('media.discard')}
            </button>
            {photo && !sample && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setPhoto('');
                  void openCamera();
                }}
              >
                {t('media.retake')}
              </button>
            )}
          </div>
        </div>
      )}
      {!photo && !voice && !recording && !camera && (
        <button
          type="button"
          className="text-button sample-button"
          onClick={() => {
            setPhoto('/sample-document.svg');
            setSample(true);
            setError('');
          }}
        >
          <FlaskConical size={14} />
          {t('media.sample')}
        </button>
      )}
    </div>
  );
}
