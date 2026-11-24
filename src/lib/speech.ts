import type { VoiceTemplatesConfig } from '../types';

export type VoiceOutcome = 'success' | 'late' | 'failure' | 'closed' | 'alreadyRecorded';

function applyNamePlaceholder(template: string, personName?: string | null): string {
  const cleanName = personName?.trim() || 'Peserta';
  return template.replace(/\{name\}/gi, cleanName);
}

export function formatVoiceMessage(
  templates: VoiceTemplatesConfig,
  outcome: VoiceOutcome,
  personName?: string | null,
): string {
  const cleanName = personName?.trim();
  if (outcome === 'late') {
    const tpl = templates.late || 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT';
    return applyNamePlaceholder(tpl, cleanName);
  }
  if (outcome === 'closed') {
    const tpl = templates.closed || 'MAAF, WAKTU ABSENSI MASIH DITUTUP';
    return applyNamePlaceholder(tpl, cleanName);
  }
  if (outcome === 'alreadyRecorded') {
    const tpl = templates.alreadyRecorded || 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI';
    return applyNamePlaceholder(tpl, cleanName);
  }
  if (outcome === 'failure') {
    return applyNamePlaceholder(templates.failure || 'ABSEN GAGAL', cleanName);
  }
  if (cleanName && templates.namedSuccess) {
    return templates.namedSuccess.replace(/\{name\}/gi, cleanName);
  }
  return templates.success || 'ABSEN BERHASIL';
}

export function speakAnnouncement(text: string, enabled: boolean): void {
  if (!enabled || !text.trim()) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    synth.speak(utterance);
  } catch {
    // Speech synthesis failure must never interrupt attendance flow
  }
}
