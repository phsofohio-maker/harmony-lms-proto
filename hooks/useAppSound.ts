import { useRef, useCallback } from 'react';
import Snd from 'snd-lib';

const SOUND_KEY = 'hhcalms_sound_enabled';

export function useAppSound() {
  const sndRef = useRef<Snd | null>(null);
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return sndRef.current;
    const snd = new Snd();
    await snd.load(Snd.KITS.SND01);
    sndRef.current = snd;
    loadedRef.current = true;
    return snd;
  }, []);

  const isEnabled = () => localStorage.getItem(SOUND_KEY) !== 'false';

  const play = useCallback(async (sound: string) => {
    if (!isEnabled()) return;
    try {
      const snd = await ensureLoaded();
      snd?.play(sound);
    } catch {
      /* swallow audio errors */
    }
  }, [ensureLoaded]);

  return {
    playSuccess: () => play(Snd.SOUNDS.CELEBRATION),
    playTap: () => play(Snd.SOUNDS.TAP),
    playButton: () => play(Snd.SOUNDS.BUTTON),
    playNotification: () => play(Snd.SOUNDS.NOTIFICATION),
    playCaution: () => play(Snd.SOUNDS.CAUTION),
    playError: () => play(Snd.SOUNDS.TRANSITION_DOWN),
    toggleSound: () => {
      const next = !isEnabled();
      localStorage.setItem(SOUND_KEY, String(next));
      return next;
    },
    isSoundEnabled: isEnabled,
  };
}
