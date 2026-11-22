/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';

export const useSpeech = () => {
  const speak = React.useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Customize voice if needed
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prefer a natural sounding English voice if available
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices[0];
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
};
