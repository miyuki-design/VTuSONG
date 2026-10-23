import type { Song } from './types'

// 接続しない状態でWAV書き出し・画面をテストするための固定サンプル。AI生成ではない。
const roots = [60, 57, 53, 55, 60, 57, 53, 55, 60, 55, 57, 53, 60, 55, 53, 60]
const qualities = ['major', 'minor', 'major', 'major', 'major', 'minor', 'major', 'major', 'major', 'major', 'minor', 'major', 'major', 'major', 'major', 'major'] as const
export const demoSong: Song = {
  title: '青い朝のプロローグ', genre: 'J-POP', theme: '新しい朝', mood: '爽やか', key: 'C major', bpm: 112, bars: 16,
  chords: roots.map((root,i) => ({root,quality:qualities[i]})),
  lyrics: [
    'まだ眠る街に','そっと光が差す','昨日の涙を','風がさらってく',
    '胸の奥にある','小さな願いを','今日は信じたい','ここから始まる',
    '青い朝を越えて','私の声を届け','迷いながらだって','明日へ歩いてゆく',
    '名前のない歌が','空いっぱい響く','新しいページを','今ここで開こう',
  ].map((text,bar)=>({bar,text})),
  melody: roots.flatMap((_,bar)=>[0,1,2,3].map((beat,i)=>({bar,beat,duration:1,midi:[64,67,69,67,64,62,60,62,72,71,69,67,69,67,64,72][bar] + [0,0,2,-1][i]}))),
  arrangement: [
    {instrument:'piano',pattern:'arpeggio',level:.7},
    {instrument:'guitar',pattern:'strum',level:.4},
    {instrument:'bass',pattern:'pulse',level:.8},
    {instrument:'drums',pattern:'groove',level:.75},
    {instrument:'strings',pattern:'pad',level:.25},
  ],
}
