// Cloudflare Worker - APIキーをiOSクライアントへ渡さないAI作曲バックエンド。
const INSTRUMENTS = ['piano','guitar','bass','drums','strings','synth']
const PATTERNS = ['pulse','arpeggio','strum','pad','groove']
const qualities = ['major','minor','dom7','sus4']
const props = (properties)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
const schema = props({
  title:{type:'string'},genre:{type:'string'},theme:{type:'string'},mood:{type:'string'},
  key:{type:'string'},bpm:{type:'integer'},bars:{type:'integer'},
  lyrics:{type:'array',items:props({bar:{type:'integer'},text:{type:'string'}})},
  chords:{type:'array',items:props({root:{type:'integer'},quality:{type:'string',enum:qualities}})},
  melody:{type:'array',items:props({bar:{type:'integer'},beat:{type:'number'},duration:{type:'number'},midi:{type:'integer'}})},
  arrangement:{type:'array',items:props({instrument:{type:'string',enum:INSTRUMENTS},pattern:{type:'string',enum:PATTERNS},level:{type:'number'}})}
})
const headers = {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers})

export function verifyInput(raw){
  if(!raw||typeof raw!=='object')throw new Error('入力形式が正しくありません')
  const genre=String(raw.genre||'').slice(0,40), theme=String(raw.theme||'').slice(0,160), mood=String(raw.mood||'').slice(0,50)
  const vocalRange=['low','middle','high'].includes(raw.vocalRange)?raw.vocalRange:'middle'
  const instruments=Array.isArray(raw.instruments)?[...new Set(raw.instruments.filter(x=>INSTRUMENTS.includes(x)))]:[]
  if(!genre||!instruments.length)throw new Error('ジャンルと楽器を指定してください')
  return {genre,theme,mood,vocalRange,instruments}
}
function inspectSong(song,input){
  if(!song||song.bars!==16||!Array.isArray(song.chords)||song.chords.length!==16||!Array.isArray(song.lyrics)||song.lyrics.length!==16)throw new Error('歌詞またはコードの小節数が不足しています')
  if(!Number.isFinite(song.bpm)||song.bpm<60||song.bpm>180)throw new Error('BPMが範囲外です')
  if(!Array.isArray(song.melody)||song.melody.length<24||song.melody.length>160)throw new Error('メロディーが不完全です')
  if(!song.melody.every(n=>Number.isInteger(n.bar)&&n.bar>=0&&n.bar<16&&Number.isFinite(n.beat)&&n.beat>=0&&n.beat<4&&Number.isFinite(n.duration)&&n.duration>0&&n.beat+n.duration<=4.001&&Number.isInteger(n.midi)&&n.midi>=45&&n.midi<=88))throw new Error('音符データの検証に失敗しました')
  if(!song.chords.every(c=>Number.isInteger(c.root)&&c.root>=36&&c.root<=83&&qualities.includes(c.quality)))throw new Error('コードデータの検証に失敗しました')
  if(!song.lyrics.every(l=>Number.isInteger(l.bar)&&l.bar>=0&&l.bar<16&&typeof l.text==='string'))throw new Error('歌詞データの検証に失敗しました')
  if(!Array.isArray(song.arrangement)||song.arrangement.length!==input.instruments.length||!input.instruments.every(i=>song.arrangement.some(a=>a.instrument===i))||!song.arrangement.every(a=>input.instruments.includes(a.instrument)&&PATTERNS.includes(a.pattern)&&Number.isFinite(a.level)&&a.level>=0&&a.level<=1))throw new Error('楽器選択が正しく反映されていません')
  if(typeof song.title!=='string'||song.title.length>80)throw new Error('タイトルデータが不正です')
  return song
}
export async function createSong(input,env,revision=null){
  if(!env.OPENAI_API_KEY)throw new Error('サーバー側のOPENAI_API_KEYが未設定です')
  const range=input.vocalRange==='low'?'MIDI 48-67 (C3-G4)':input.vocalRange==='high'?'MIDI 60-81 (C4-A5)':'MIDI 55-76 (G3-E5)'
  const instruction=`あなたはプロの日本語ポップス作詞家・作曲家・編曲家です。歌えるオリジナル楽曲を制作し、JSON形式で返す。
指定ジャンルと楽器を尊重し、音楽ジャンル特有のコード進行、リズム、旋律の抑揚、アレンジを独自に考える。
必ず16小節・4/4拍子・全16小節に1つずつコードと短い日本語の歌詞を作る。
歌詞は16行。序盤8小節はAメロ、後半8小節はサビ。メロディーは小節0-15すべてに2-6音、合計32-96音。
音符はbar=0～15、beat=0/0.5/1/1.5/2/2.5/3/3.5、duration=0.5/1/1.5/2のいずれか。beat+duration <= 4。
MIDIは${range}を目安に歌いやすく、音符の繰り返しばかりにならず跳躍を控えめにする。なるべく日本語の発音とリズムが噛み合う旋律にする。
コードrootはMIDIノート番号で1小節1コードとし、適切な和声進行にする。ルート音の目安はMIDI 48-71。
arrangementは指定楽器を全て、1回ずつ含め、他の楽器は足さない。instrumentは英語、patternはpulse/arpeggio/strum/pad/groove、levelは0～1。編曲をジャンルに合わせて工夫する。
楽曲の構造、歌詞、メロディー、和音が整合すること。既存曲や既存歌詞の複製を避ける。`
  const revisionHints = {
    lyrics:'歌詞だけ新しくして。同じメロディーで歌いやすい歌詞を考えて。',
    melody:'メロディーだけ再作曲して。元の歌詞とコードに合うように。',
    arrangement:'指定楽器の奏法パターンと各音量バランスのみ再編曲して。',
    chorus:'後半8小節のサビ（8-15小節）の歌詞・メロディー・コードを新しくして。',
  }
  const task=revision ? `既存曲の一部分を修正してください。変更対象：${revisionHints[revision.mode]}\n変更対象以外は元の楽曲データをできるだけ保持する。\n元の楽曲JSON：${JSON.stringify(revision.song)}` : '必ず16小節の作詞作曲編曲を完成させてください。'
  const res=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',temperature:.7,
      max_completion_tokens:7500,
      messages:[{role:'system',content:instruction},{role:'user',content:`ジャンル：${input.genre}\n楽器：${input.instruments.join(', ')}\n歌詞のテーマ：${input.theme||'自由'}\n雰囲気：${input.mood||'おまかせ'}\n歌いやすい音域：${range}\n${task}`}],
      response_format:{type:'json_schema',json_schema:{name:'vtusong_song',strict:true,schema}}})
  })
  if(!res.ok){const problem=await res.text();throw new Error(`AI API (${res.status}): ${problem.slice(0,250)}`)}
  const data=await res.json()
  const content=data?.choices?.[0]?.message?.content
  if(!content)throw new Error('AIが楽曲データを返しませんでした')
  const next=JSON.parse(content)
  if(!revision)return inspectSong(next,input)
  // 修正対象外のデータは必ず旧曲から復元し、予期しない上書きを防止する。
  const old=revision.song
  const song={...old}
  switch(revision.mode){
    case 'lyrics': song.lyrics=next.lyrics; break
    case 'melody': song.melody=next.melody; break
    case 'arrangement': song.arrangement=next.arrangement; break
    case 'chorus':
      song.lyrics=[...old.lyrics.filter(l=>l.bar<8),...next.lyrics.filter(l=>l.bar>=8)]
      song.melody=[...old.melody.filter(n=>n.bar<8),...next.melody.filter(n=>n.bar>=8)]
      song.chords=old.chords.map((c,i)=>i>=8?next.chords[i]:c)
      break
  }
  return inspectSong(song,input)
}
export default {
  async fetch(request,env){
    const url=new URL(request.url)
    if(request.method==='OPTIONS')return new Response(null,{headers})
    if(url.pathname==='/health')return json({ok:true,service:'VTuSONG AI'})
    if(!['/api/generate','/api/revise'].includes(url.pathname))return json({error:'Not found'},404)
    if(request.method!=='POST')return json({error:'POST only'},405)
    if(Number(request.headers.get('Content-Length')||0)>32768)return json({error:'入力が長すぎます'},413)
    let input, revision=null
    try{
      const body=await request.json()
      input=verifyInput(body.input ?? body)
      if(url.pathname==='/api/revise'){
        if(!['lyrics','melody','arrangement','chorus'].includes(body.mode))throw new Error('修正対象が不正です')
        const song=inspectSong(body.song,input)
        revision={mode:body.mode,song}
      }
    }catch(err){return json({error:err.message},400)}
    try{return json({song:await createSong(input,env,revision)})}
    catch(err){console.error('song generation failed',err?.message);return json({error:'AI生成に失敗しました。少し条件を変えて再試行してください。',detail:String(err?.message||'').slice(0,160)},502)}
  }
}
