export const INSTRUMENTS = ['piano', 'guitar', 'bass', 'drums', 'strings', 'synth'] as const
export type Instrument = (typeof INSTRUMENTS)[number]
export type Pattern = 'pulse' | 'arpeggio' | 'strum' | 'pad' | 'groove'
export interface Note { bar: number; beat: number; duration: number; midi: number }
export interface Chord { root: number; quality: 'major' | 'minor' | 'dom7' | 'sus4' }
export interface Arrangement { instrument: Instrument; pattern: Pattern; level: number }
export interface Lyric { bar: number; text: string }
export interface Song {
  title: string
  genre: string
  theme: string
  mood: string
  key: string
  bpm: number
  bars: number
  lyrics: Lyric[]
  melody: Note[]
  chords: Chord[]
  arrangement: Arrangement[]
}
export interface GenerateInput {
  genre: string
  instruments: Instrument[]
  theme: string
  mood: string
  vocalRange: 'low' | 'middle' | 'high'
}
export const NAMES: Record<Instrument,string> = {
  piano: 'ピアノ', guitar: 'ギター', bass: 'ベース', drums: 'ドラム',
  strings: 'ストリングス', synth: 'シンセ',
}
export const GENRES = ['J-POP', 'アニソン', 'ロック', 'シティポップ', 'バラード', 'EDM', 'ジャズ', 'ボカロ系']
export const MOODS = ['キラキラ', '切ない', '力強い', 'かわいい', '幻想的', '爽やか', 'ダーク']

export function validateSong(value: unknown): Song {
  if (!value || typeof value !== 'object') throw new Error('楽曲データが不正です')
  const s = value as Song
  if (!Array.isArray(s.melody) || !Array.isArray(s.chords) || !Array.isArray(s.arrangement) || !Array.isArray(s.lyrics)) throw new Error('楽曲トラックが不足しています')
  if (!Number.isInteger(s.bars) || s.bars !== 16) throw new Error('楽曲の小節数が不正です')
  if (!Number.isFinite(s.bpm) || s.bpm < 60 || s.bpm > 180) throw new Error('BPMが範囲外です')
  if (s.chords.length !== s.bars || s.melody.length < 8 || s.melody.length > 160) throw new Error('作曲データが不完全です')
  if (s.lyrics.length !== s.bars) throw new Error('歌詞データが不完全です')
  if (!s.melody.every(n => Number.isInteger(n.bar) && n.bar >= 0 && n.bar < s.bars && Number.isFinite(n.beat) && n.beat >= 0 && n.beat < 4 && Number.isFinite(n.duration) && n.duration > 0 && n.beat + n.duration <= 4.001 && Number.isInteger(n.midi) && n.midi >= 45 && n.midi <= 88)) throw new Error('メロディーの音符が不正です')
  if (!s.chords.every(c => Number.isInteger(c.root) && c.root >= 36 && c.root <= 83 && ['major','minor','dom7','sus4'].includes(c.quality))) throw new Error('コードが不正です')
  if (!s.arrangement.every(a => INSTRUMENTS.includes(a.instrument) && ['pulse','arpeggio','strum','pad','groove'].includes(a.pattern) && Number.isFinite(a.level) && a.level >= 0 && a.level <= 1)) throw new Error('編曲情報が不正です')
  if (!s.lyrics.every(l => Number.isInteger(l.bar) && l.bar >= 0 && l.bar < s.bars && typeof l.text === 'string')) throw new Error('歌詞が不正です')
  if (typeof s.title !== 'string' || typeof s.key !== 'string' || typeof s.genre !== 'string') throw new Error('曲名が不正です')
  return s
}
