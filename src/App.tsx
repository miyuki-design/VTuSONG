import { useEffect, useState } from 'react'
import { AudioLines, WandSparkles, Play, Square, Download, Music2, FileMusic, ChevronDown, RotateCcw, PencilLine, Volume2, Sparkles, Library, Heart, Trash2 } from 'lucide-react'
import type { GenerateInput, Instrument, Song } from './types'
import { GENRES, INSTRUMENTS, MOODS, NAMES, validateSong } from './types'
import { demoSong } from './demo'
import { play, stop, renderWav, saveWav } from './audio'

const defaultForm:GenerateInput={genre:'J-POP',instruments:['piano','guitar','bass','drums'],theme:'新しい一歩を踏み出す',mood:'キラキラ',vocalRange:'middle'}
const STORAGE='vtusong.v1.song'
const LIBRARY_STORAGE='vtusong.v2.library'
type LibraryEntry={id:string;createdAt:string;updatedAt:string;favorite:boolean;song:Song}
function readLibrary():LibraryEntry[]{
  try {
    const json=localStorage.getItem(LIBRARY_STORAGE)
    const entries=json?JSON.parse(json):null
    if(Array.isArray(entries))return entries.filter(e=>{
      try{validateSong(e.song);return typeof e.id==='string'&&typeof e.createdAt==='string'}catch{return false}
    }).map(e=>({...e,favorite:!!e.favorite}))
  }catch{/* Corrupt storage: fall back to legacy song */}
  try{const json=localStorage.getItem(STORAGE);if(json){const song=validateSong(JSON.parse(json));const now=new Date().toISOString();return [{id:crypto.randomUUID(),createdAt:now,updatedAt:now,favorite:false,song}]}}catch{/* No legacy song */}
  return []
}
const initialLibrary=readLibrary()
function readActiveId():string|null{
  try{const selected=localStorage.getItem('vtusong.v2.active');if(selected&&initialLibrary.some(e=>e.id===selected))return selected}catch{}
  return initialLibrary[0]?.id??null
}
function getInitialSong():Song|null{return initialLibrary.find(e=>e.id===readActiveId())?.song??null}
function createEntry(song:Song):LibraryEntry{const now=new Date().toISOString();return {id:crypto.randomUUID(),createdAt:now,updatedAt:now,favorite:false,song}}
function showDate(iso:string){try{return new Date(iso).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return iso}}

function songBpm(song:Song|null){return song?.bpm??120}
function safeError(error:unknown){return error instanceof Error?error.message:'不明なエラー'}
export default function App(){
  const [form,setForm]=useState<GenerateInput>(defaultForm)
  const [library,setLibrary]=useState<LibraryEntry[]>(initialLibrary)
  const [activeId,setActiveId]=useState<string|null>(()=>readActiveId())
  const [song,setSong]=useState<Song|null>(()=>getInitialSong())
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [playing,setPlaying]=useState(false)
  const [previewMode,setPreviewMode]=useState<'demo'|'offvocal'|'melody'>('demo')
  const [position,setPosition]=useState(0)
  const [tab,setTab]=useState<'create'|'song'|'library'>('create')
  const [editLyrics,setEditLyrics]=useState(false)
  const [editBar,setEditBar]=useState(8)
  const [isDemo,setIsDemo]=useState(false)
  useEffect(()=>{
    try{localStorage.setItem(LIBRARY_STORAGE,JSON.stringify(library))}catch{setNotice('端末の保存領域が不足しています。曲ライブラリを保存できませんでした。')}
  },[library])
  useEffect(()=>{try{if(activeId)localStorage.setItem('vtusong.v2.active',activeId);else localStorage.removeItem('vtusong.v2.active')}catch{}},[activeId])
  // Preserve edits, partial regenerations, BPM, track volumes and title for the selected song.
  useEffect(()=>{
    if(!song||!activeId)return
    setLibrary(items=>items.map(item=>item.id===activeId&&item.song!==song?{...item,song,updatedAt:new Date().toISOString()}:item))
  },[song,activeId])
  function openEntry(entry:LibraryEntry){stop();setPlaying(false);setPosition(0);setSong(entry.song);setActiveId(entry.id);setIsDemo(false);setEditLyrics(false);setTab('song');setNotice('保存した曲を開きました。')}
  function toggleFavorite(id:string){setLibrary(items=>items.map(e=>e.id===id?{...e,favorite:!e.favorite}:e))}
  function deleteEntry(id:string){
    const target=library.find(e=>e.id===id);if(!target||!window.confirm(`「${target.song.title}」をライブラリから削除しますか？`))return
    const remaining=library.filter(e=>e.id!==id)
    setLibrary(remaining)
    if(activeId===id){stop();setPlaying(false);setPosition(0);const next=remaining[0]??null;setActiveId(next?.id??null);setSong(next?.song??null);setTab(next?'song':'create')}
    setNotice('曲を削除しました。')
  }
  useEffect(()=>()=>stop(),[])
  function toggleInstrument(instrument:Instrument){setForm(f=>({...f,instruments:f.instruments.includes(instrument)?f.instruments.filter(x=>x!==instrument):[...f.instruments,instrument]}))}
  async function generate(){
    if(form.instruments.length===0){setNotice('使いたい楽器を1つ以上選んでね');return}
    setBusy(true);setNotice('AIが歌詞・メロディー・編曲を考えています…');stop();setPlaying(false);setPosition(0)
    try{
      const base=import.meta.env.VITE_API_BASE_URL?.trim()
      if(!base)throw new Error('AI接続先が未設定です。READMEを参考にVITE_API_BASE_URLを設定してください。')
      const resp=await fetch(`${base.replace(/\/$/,'')}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      const data=await resp.json()
      if(!resp.ok)throw new Error(data.error??`API error ${resp.status}`)
      const next=validateSong(data.song)
      const entry=createEntry(next);setLibrary(items=>[entry,...items]);setActiveId(entry.id);setSong(next);setIsDemo(false);setTab('song');setEditLyrics(false);setNotice('AIが楽曲を制作しました！')
    }catch(err){setNotice(`生成できませんでした：${safeError(err)}`)}finally{setBusy(false)}
  }
  async function revise(mode:'lyrics'|'melody'|'arrangement'|'chorus'){
    if(!song)return
    const base=import.meta.env.VITE_API_BASE_URL?.trim()
    if(!base){setNotice('AI接続先が未設定です。READMEの設定を確認してください。');return}
    stop();setPlaying(false);setBusy(true);setNotice('AIが指定部分を作り直しています…')
    try{
      const res=await fetch(`${base.replace(/\/$/,'')}/api/revise`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:{...form,genre:song.genre,theme:song.theme,mood:song.mood,instruments:song.arrangement.map(a=>a.instrument)},mode,song})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error??`API error ${res.status}`)
      setSong(validateSong(data.song));setIsDemo(false);setNotice('指定した部分だけ更新しました。')
    }catch(err){setNotice(`再生成できませんでした：${safeError(err)}`)}finally{setBusy(false)}
  }
  function changeNote(index:number,amount:number){setSong(s=>s?{...s,melody:s.melody.map((n,i)=>i===index?{...n,midi:Math.max(45,Math.min(88,n.midi+amount))}:n)}:null)}
  function sample(){stop();setPlaying(false);setActiveId(null);setSong(structuredClone(demoSong));setIsDemo(true);setTab('song');setNotice('動作確認用のサンプルです（AI生成ではありません）')}
  async function togglePlay(){
    if(!song)return
    if(playing){stop();setPlaying(false);setPosition(0);return}
    try{setPlaying(true);await play(song,previewMode,()=>{setPlaying(false);setPosition(0)},setPosition)}catch(err){setPlaying(false);setNotice(`再生できません：${safeError(err)}`)}
  }
  async function exportFile(mode:'demo'|'offvocal'){
    if(!song)return
    stop();setPlaying(false);setBusy(true);setNotice('WAV音源を書き出しています…')
    try{
      const wav=await renderWav(song,mode)
      await saveWav(wav,`${song.title}_${mode==='demo'?'ガイドメロディー入り':'オフボーカル'}`)
      setNotice('WAV作成完了。共有シートから「ファイルに保存」してVTuRECへ取り込めます。')
    }catch(err){setNotice(`書き出し失敗：${safeError(err)}`)}finally{setBusy(false)}
  }
  const beatNow=position*songBpm(song)/60
  const currentNote=playing&&song?([...song.melody].sort((a,b)=>a.bar-b.bar||a.beat-b.beat).find(n=>{
    const start=n.bar*4+n.beat
    return beatNow>=start&&beatNow<start+n.duration
  })??null):null
  const currentBar=Math.min(song?.bars??16,Math.floor(beatNow/4)+1)-1
  const updateSong=(field:'title'|'bpm',value:string)=>setSong(s=>s?{...s,[field]:field==='bpm'?Math.max(60,Math.min(180,Number(value)||s.bpm)):value}:null)
  return <div className="app">
    <header className="app-header"><div className="brand-mark"><AudioLines size={22}/></div><div><div className="brand">VTu<span>SONG</span><span className="pill">BETA</span></div><div className="tagline">AI MUSIC STUDIO</div></div><div className="header-icon"><Music2 size={22}/></div></header>
    <main>
      <section className="hero"><div className="sparkle"><Sparkles size={17}/> YOUR MUSIC, YOUR STORY</div><h1>想いを、<br/><em>音楽にしよう。</em></h1><p>ジャンルと楽器を選ぶだけ。<br/>AIと一緒に、あなただけの一曲を。</p><div className="hero-glow"/></section>
      <div className="tabs"><button className={tab==='create'?'active':''} onClick={()=>setTab('create')}><WandSparkles size={17}/> AI作曲</button><button className={tab==='song'?'active':''} onClick={()=>setTab('song')} disabled={!song}><FileMusic size={17}/> 制作した曲 {song?'●':''}</button><button className={tab==='library'?'active':''} onClick={()=>setTab('library')}><Library size={17}/> 曲ライブラリ ({library.length})</button></div>
      {tab==='library'?<section className="card"><div className="section-title"><span className="number">♫</span><h2>曲ライブラリ</h2></div><p className="hint">生成した曲と編集内容は、このiPhoneのアプリ内に自動保存されます。曲を選ぶと、歌詞の確認・編集・試聴・WAV出力ができます。</p>
        {library.length===0?<p className="library-empty">まだ保存した曲がありません。AI作曲から最初の一曲を作ろう。</p>:<div className="library-list">{[...library].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.createdAt.localeCompare(a.createdAt)).map(entry=><div className="library-row" key={entry.id}>
          <button className="library-open" onClick={()=>openEntry(entry)}><strong>{entry.song.title||'無題の曲'}</strong><span>{entry.song.genre} · BPM {entry.song.bpm} · {entry.song.bars}小節</span><small>{showDate(entry.createdAt)}</small></button>
          <button className={`library-icon ${entry.favorite?'favorite':''}`} title={entry.favorite?'お気に入り解除':'お気に入りに登録'} aria-label={entry.favorite?'お気に入り解除':'お気に入りに登録'} onClick={()=>toggleFavorite(entry.id)}><Heart size={19} fill={entry.favorite?'currentColor':'none'}/></button>
          <button className="library-icon" title="曲を削除" aria-label={`${entry.song.title}を削除`} onClick={()=>deleteEntry(entry.id)}><Trash2 size={19}/></button>
        </div>)}</div>}
        <p className="hint">※保存先はアプリ内の端末ストレージです。アプリを削除したりデータを消去したりすると曲が失われる場合があります。</p>
      </section>:tab==='create'?<>
        <section className="card"><div className="section-title"><span className="number">01</span><h2>音楽のスタイル</h2></div><p className="hint">どんなジャンルの曲を作りたい？</p><div className="chip-list">{GENRES.map(x=><button key={x} className={`chip ${form.genre===x?'selected':''}`} onClick={()=>setForm(f=>({...f,genre:x}))}>{x}</button>)}</div></section>
        <section className="card"><div className="section-title"><span className="number">02</span><h2>使いたい楽器 <small>複数選択OK</small></h2></div><div className="instrument-grid">{INSTRUMENTS.map(x=><button key={x} className={`instrument ${form.instruments.includes(x)?'chosen':''}`} onClick={()=>toggleInstrument(x)}><span className="instrument-icon">{({piano:'🎹',guitar:'🎸',bass:'🎵',drums:'🥁',strings:'🎻',synth:'🎛️'} as const)[x]}</span><span>{NAMES[x]}</span><span className="check">{form.instruments.includes(x)?'✓':'+'}</span></button>)}</div></section>
        <section className="card"><div className="section-title"><span className="number">03</span><h2>曲のイメージ</h2></div><label className="field-label">歌詞のテーマ</label><textarea rows={2} value={form.theme} maxLength={160} placeholder="曲にしたい気持ち、情景、物語を入力…" onChange={e=>setForm(f=>({...f,theme:e.target.value}))}/><label className="field-label">雰囲気</label><div className="chip-list">{MOODS.map(x=><button key={x} className={`chip ${form.mood===x?'selected':''}`} onClick={()=>setForm(f=>({...f,mood:x}))}>{x}</button>)}</div><label className="field-label">歌いやすい音域</label><div className="range-switch">{([['low','低め'],['middle','標準'],['high','高め']] as const).map(([x,label])=><button key={x} className={form.vocalRange===x?'chosen':''} onClick={()=>setForm(f=>({...f,vocalRange:x}))}>{label}</button>)}</div></section>
        <button disabled={busy||form.instruments.length===0} className="cta" onClick={generate}><WandSparkles size={21}/>{busy?'AIが作曲しています…':'AIで楽曲を生成'} <span>✦</span></button>
        <button className="sample" onClick={sample}><Play size={16}/> まずサンプル音源を試す</button>
        <p className="under">作詞・作曲・編曲をAIが生成。初期版は16小節、歌声の録音はVTuRECへ。</p>
      </>:song?<>
        <section className="song-head card"><div className="cover"><AudioLines size={52}/></div><div className="song-summary"><div className="song-kicker">{isDemo?'DEMO TRACK':'AI COMPOSED TRACK'} {activeId?' · 自動保存中':''}</div><input aria-label="曲名" value={song.title} onChange={e=>updateSong('title',e.target.value)} className="song-title"/><div className="song-meta">{song.genre} ・ {song.key} ・ {song.bars}小節</div><div className="bpm"><span>BPM</span><input type="number" min="60" max="180" value={song.bpm} onChange={e=>updateSong('bpm',e.target.value)}/></div></div></section>
        <section className="card"><div className="section-title"><span className="number">♫</span><h2>試聴</h2></div><div className="range-switch">{([['demo','ガイド入り'],['melody','メロディーのみ'],['offvocal','オフボーカル']] as const).map(([m,label])=><button key={m} className={previewMode===m?'chosen':''} onClick={()=>{stop();setPlaying(false);setPosition(0);setPreviewMode(m)}}>{label}</button>)}</div><button className="player" onClick={togglePlay}>{playing?<Square size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}{playing?'停止':'再生'}<span><Volume2 size={17}/> {Math.round(song.bars*4*60/song.bpm)}秒</span></button><p className="hint">音符に歌詞が割り当てられた新しい曲は、再生中に歌う言葉が光ります。以前の曲や手動編集した行は小節単位の表示です。</p></section>
        <section className="card"><div className="section-title"><span className="number">✍</span><h2>歌詞</h2><button className="text-button" onClick={()=>setEditLyrics(v=>!v)}><PencilLine size={15}/>{editLyrics?'完了':'編集'}</button></div><div className="lyrics" aria-label="歌詞（再生中は小節単位で同期表示）">{song.lyrics.map((l,index)=><div className={`lyric-line ${playing && index===currentBar?'lyric-active':''}`} key={index}><span>{String(index+1).padStart(2,'0')}</span>{editLyrics?<input value={l.text} aria-label={`${index+1}小節目の歌詞`} onChange={e=>setSong(s=>s?{...s,lyrics:s.lyrics.map((item,i)=>i===index?{...item,text:e.target.value}:item),melody:s.melody.map(n=>n.bar===index?{...n,lyric:undefined}:n)}:null)}/>:<p>{l.text && song.melody.some(n=>n.bar===index&&n.lyric!==undefined) ?
  song.melody.filter(n=>n.bar===index).slice().sort((a,b)=>a.beat-b.beat).map((n,j)=><span key={`${index}-${j}`} className={`lyric-fragment ${playing&&currentNote===n?'fragment-active':''}`}>{n.lyric??''}</span>)
  :l.text}</p>}</div>)}</div></section>
        <section className="card"><div className="section-title"><span className="number">♪</span><h2>メロディー編集</h2></div><p className="hint">小節を選び、音程を半音ずつ調整できます。</p><div className="bar-grid">{Array.from({length:16},(_,i)=><button key={i} className={editBar===i?'chosen':''} onClick={()=>setEditBar(i)}>{i+1}</button>)}</div><div className="note-list">{song.melody.map((n,i)=>({n,i})).filter(({n})=>n.bar===editBar).sort((a,b)=>a.n.beat-b.n.beat).map(({n,i})=><div className="note-row" key={i}><span>{n.beat+1}拍目</span><span className="note-lyric">{n.lyric??'—'}</span><span className="note-midi">MIDI {n.midi}</span><button aria-label="半音下げる" onClick={()=>changeNote(i,-1)}>−</button><button aria-label="半音上げる" onClick={()=>changeNote(i,1)}>＋</button></div>)}</div></section>
        <section className="card"><div className="section-title"><span className="number">🎼</span><h2>編曲トラック</h2></div>{song.arrangement.map((a,index)=><div className="track" key={index}><div className="track-name"><Music2 size={17}/>{NAMES[a.instrument]}<small>{a.pattern}</small></div><input type="range" min="0" max="1" step=".05" aria-label={`${NAMES[a.instrument]}の音量`} value={a.level} onChange={e=>setSong(s=>s?{...s,arrangement:s.arrangement.map((item,i)=>i===index?{...item,level:Number(e.target.value)}:item)}:null)}/></div>)}<p className="hint">音量を0にすると、その楽器は書き出しから除外されます。</p></section>
        <section className="card"><div className="section-title"><span className="number">✦</span><h2>AIで部分再生成</h2></div><p className="hint">気に入った部分は残し、選んだ部分だけ作り直します。</p><div className="revise-grid"><button disabled={busy} onClick={()=>revise('lyrics')}>✍ 歌詞だけ</button><button disabled={busy} onClick={()=>revise('melody')}>♫ メロディーだけ</button><button disabled={busy} onClick={()=>revise('arrangement')}>🎹 編曲だけ</button><button disabled={busy} onClick={()=>revise('chorus')}>✦ サビだけ</button></div></section>
        <section className="card export-card"><div className="section-title"><span className="number">⇩</span><h2>音源を書き出す</h2></div><p className="hint">WAV 44.1kHz / 16bit / ステレオ</p><button disabled={busy} className="export-button primary" onClick={()=>exportFile('offvocal')}><Download size={20}/> オフボーカル WAV <span>VTuREC用</span></button><button disabled={busy} className="export-button" onClick={()=>exportFile('demo')}><Download size={20}/> ガイドメロディー入り WAV</button><div className="helper">iPhoneの共有シートで「ファイルに保存」 → VTuRECに取り込み。</div></section>
        <button className="sample" onClick={()=>{stop();setPlaying(false);setTab('library')}}><Library size={16}/> 曲ライブラリを開く</button>
        <button className="sample" onClick={()=>{stop();setPlaying(false);setTab('create')}}><RotateCcw size={16}/> 別の楽曲を作る</button>
      </>:null}
      {notice&&<div className="notice" role="status"><span>{notice}</span><button aria-label="通知を閉じる" onClick={()=>setNotice('')}>×</button></div>}
    </main><footer><div>VTuSONG <span>×</span> VTuREC</div><p>Made for your original music.</p><ChevronDown size={14}/></footer>
  </div>
}
