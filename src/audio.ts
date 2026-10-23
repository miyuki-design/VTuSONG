import type { Song, Instrument, Chord } from './types'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export type RenderMode = 'demo' | 'offvocal'
type Context = AudioContext | OfflineAudioContext
const SR = 44100
const clamp = (x:number,min:number,max:number) => Math.min(max,Math.max(min,x))
const midiFreq = (midi:number)=> 440 * Math.pow(2,(midi - 69)/12)

function tone(ctx:Context, output: AudioNode, midi:number, start:number, duration:number,
  options:{wave?: OscillatorType, gain?:number, attack?:number, release?:number, lowpass?:number, detune?:number}={}) {
  const gain = ctx.createGain()
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.frequency.value = options.lowpass ?? 9000
  osc.type = options.wave ?? 'triangle'
  osc.frequency.value = midiFreq(midi)
  osc.detune.value = options.detune ?? 0
  osc.connect(filter); filter.connect(gain); gain.connect(output)
  const attack = Math.max(.005,options.attack ?? .015)
  const release = Math.max(.02,options.release ?? .12)
  const peak = options.gain ?? .06
  const end = start + Math.max(.06,duration)
  gain.gain.setValueAtTime(0,start)
  gain.gain.linearRampToValueAtTime(peak,start+attack)
  gain.gain.setTargetAtTime(peak*.62,start+attack,.22)
  gain.gain.setValueAtTime(peak*.62,end)
  gain.gain.exponentialRampToValueAtTime(.0001,end+release)
  osc.start(start); osc.stop(end+release+.04)
}
function shortNoise(ctx:Context, output:AudioNode,start:number, duration:number,level:number, hi:number) {
  const count = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1,count,ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let seed = 177 + Math.floor(start * 1000)
  for (let i=0;i<count;i++) { seed=(seed*1664525+1013904223)>>>0; data[i] = seed/2147483648 - 1 }
  const source = ctx.createBufferSource()
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=hi
  const amp=ctx.createGain()
  amp.gain.setValueAtTime(level,start)
  amp.gain.exponentialRampToValueAtTime(.0001,start+duration)
  source.buffer=buffer;source.connect(hp);hp.connect(amp);amp.connect(output)
  source.start(start);source.stop(start+duration)
}
function kick(ctx:Context,out:AudioNode,t:number,level:number) {
  const osc=ctx.createOscillator(); const amp=ctx.createGain()
  osc.type='sine';osc.frequency.setValueAtTime(148,t);osc.frequency.exponentialRampToValueAtTime(48,t+.16)
  amp.gain.setValueAtTime(level*.28,t);amp.gain.exponentialRampToValueAtTime(.0001,t+.22)
  osc.connect(amp);amp.connect(out);osc.start(t);osc.stop(t+.24)
}
function chordNotes(chord:Chord):number[] {
  const intervals = chord.quality === 'minor' ? [0,3,7] : chord.quality === 'dom7' ? [0,4,7,10] : chord.quality === 'sus4' ? [0,5,7] : [0,4,7]
  return intervals.map(i=>chord.root+i)
}
function part(ctx:Context,out:AudioNode,name:Instrument, pattern:string, chord:Chord,t:number,beat:number,level:number) {
  const notes=chordNotes(chord)
  const hit=(midi:number, offset:number,length:number,gain:number,wave:OscillatorType='triangle', filter=5500)=>
    tone(ctx,out,midi,t+offset*beat,length*beat,{gain:gain*level, wave,lowpass:filter,release:.09})
  if(name==='drums') {
    for(let b=0;b<4;b++) {
      if(b===0 || b===2 || (pattern==='groove' && b===3))kick(ctx,out,t+b*beat,level*.9)
      if(b===1 || b===3)shortNoise(ctx,out,t+b*beat,.17,.11*level,900)
      shortNoise(ctx,out,t+b*beat,.047,.032*level,5500)
      shortNoise(ctx,out,t+(b+.5)*beat,.035,.016*level,7000)
    }
  } else if(name==='bass') {
    const root=chord.root-24
    const hitBeat=pattern==='groove'?[0,1.5,2.5,3.5]:[0,2]
    hitBeat.forEach((p,i)=>hit(root+(i%3===2?7:0),p, .6,.13,'sine',600))
  } else if(name==='piano') {
    if(pattern==='arpeggio') for(let i=0;i<8;i++)hit(notes[i%notes.length]+(i>3?12:0),i*.5,.34,.065,'triangle',6000)
    else for(let p=0;p<4;p+=(pattern==='pulse'?1:2))notes.forEach((n)=>hit(n,p,.8,.048,'triangle',4500))
  } else if(name==='guitar') {
    for(let p=0;p<4;p++) notes.forEach((n,i)=>hit(n-12,p+i*.045,.30,.035,'sawtooth',1200))
  } else if(name==='strings') {
    notes.forEach(n=>tone(ctx,out,n-12,t,3.8*beat,{gain:.025*level,wave:'sawtooth',attack:.35,release:.35,lowpass:1100}))
  } else if(name==='synth') {
    if(pattern==='arpeggio') for(let i=0;i<8;i++)hit(notes[i%notes.length]+12,i*.5,.25,.035,'square',1800)
    else notes.forEach(n=>tone(ctx,out,n,t,3.3*beat,{gain:.028*level,wave:'sine',attack:.08,release:.35,lowpass:2500}))
  }
}
function schedule(ctx:Context,song:Song,mode:RenderMode,begin:number): number {
  const beat = 60/song.bpm
  const master=ctx.createDynamicsCompressor()
  master.threshold.value=-14; master.knee.value=20;master.ratio.value=3
  master.attack.value=.01; master.release.value=.22
  const gain=ctx.createGain();gain.gain.value=.83
  master.connect(gain);gain.connect(ctx.destination)
  song.arrangement.forEach(a=>{
    if(a.level <= 0) return
    for(let b=0;b<song.bars;b++)part(ctx,master,a.instrument,a.pattern,song.chords[b],begin+b*beat*4,beat,a.level)
  })
  if(mode==='demo')for(const n of song.melody){
    tone(ctx,master,n.midi,begin+(n.bar*4+n.beat)*beat,n.duration*beat*.93,{gain:.12,attack:.017,release:.12,wave:'sine',lowpass:3000})
    tone(ctx,master,n.midi+12,begin+(n.bar*4+n.beat)*beat,n.duration*beat*.93,{gain:.023,attack:.017,release:.12,wave:'triangle',lowpass:3500})
  }
  return song.bars*4*beat
}
let current:AudioContext|null = null
export async function play(song:Song, mode:RenderMode, onFinished:()=>void): Promise<void> {
  stop()
  const ctx=new AudioContext({sampleRate:SR})
  current=ctx
  await ctx.resume()
  const duration=schedule(ctx,song,mode,ctx.currentTime+.07)
  window.setTimeout(()=>{if(current===ctx){stop();onFinished()}},(duration+.6)*1000)
}
export function stop(){
  if(current){const ctx=current;current=null;void ctx.close()}
}
export async function renderWav(song:Song,mode:RenderMode):Promise<Blob> {
  const duration=song.bars*4*60/song.bpm+.8
  const length=Math.ceil(duration*SR)
  const ctx=new OfflineAudioContext(2,length,SR)
  schedule(ctx,song,mode,.03)
  const audio=await ctx.startRendering()
  return encodeWav(audio)
}
function encodeWav(audio:AudioBuffer):Blob{
  const channels=audio.numberOfChannels
  const frames=audio.length
  const buffer=new ArrayBuffer(44+frames*channels*2)
  const view=new DataView(buffer)
  const write=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
  write(0,'RIFF');view.setUint32(4,36+frames*channels*2,true)
  write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true)
  view.setUint16(20,1,true);view.setUint16(22,channels,true)
  view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*channels*2,true)
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true)
  write(36,'data');view.setUint32(40,frames*channels*2,true)
  const data=Array.from({length:channels},(_,n)=>audio.getChannelData(n))
  let offset=44
  for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){
    const x=clamp(data[c][i],-1,1)
    view.setInt16(offset,x<0?x*32768:x*32767,true);offset+=2
  }
  return new Blob([buffer],{type:'audio/wav'})
}
function blobToBase64(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{
    const r=new FileReader()
    r.onload=()=>resolve(String(r.result).split(',')[1])
    r.onerror=()=>reject(new Error('WAVを変換できませんでした'))
    r.readAsDataURL(blob)
  })
}
export async function saveWav(blob:Blob,name:string):Promise<void>{
  const filename=name.replace(/[\\/:*?"<>|]/g,'_').slice(0,90)+'.wav'
  if(Capacitor.isNativePlatform()){
    // iOS WKWebViewのblob: ダウンロード問題を回避しネイティブ共有シートへ。
    const data=await blobToBase64(blob)
    const result=await Filesystem.writeFile({path:filename,data,directory:Directory.Cache,recursive:true})
    await Share.share({title:filename,url:result.uri,dialogTitle:'WAV音源を保存・共有'})
    return
  }
  const url=URL.createObjectURL(blob)
  try {
    if(navigator.canShare&&typeof File!=='undefined'){
      const file=new File([blob],filename,{type:'audio/wav'})
      if(navigator.canShare({files:[file]})){
        try {await navigator.share({files:[file],title:filename});return} catch(e){if((e as Error).name==='AbortError')return}
      }
    }
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove()
  }finally{setTimeout(()=>URL.revokeObjectURL(url),10000)}
}
