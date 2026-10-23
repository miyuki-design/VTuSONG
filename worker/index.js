// VTuSONG genre-aware original songwriting engine v4.1 (repair patch).
// Replace worker/index.js. Preserve existing client song schema and /api endpoints.
const INSTRUMENTS=['piano','guitar','bass','drums','strings','synth'];
const PATTERNS=['pulse','arpeggio','strum','pad','groove'];
const QUALITIES=['major','minor','dom7','sus4'];
const obj=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const schema=obj({
 title:{type:'string'},genre:{type:'string'},theme:{type:'string'},mood:{type:'string'},
 key:{type:'string'},bpm:{type:'integer'},bars:{type:'integer'},
 lyrics:{type:'array',items:obj({bar:{type:'integer'},text:{type:'string'}})},
 chords:{type:'array',items:obj({root:{type:'integer'},quality:{type:'string',enum:QUALITIES}})},
 melody:{type:'array',items:obj({bar:{type:'integer'},beat:{type:'number'},duration:{type:'number'},midi:{type:'integer'},lyric:{type:'string'}})},
 arrangement:{type:'array',items:obj({instrument:{type:'string',enum:INSTRUMENTS},pattern:{type:'string',enum:PATTERNS},level:{type:'number'}})}
});
const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});

// Measurable, broadly useful songwriting features—not copies of any artist's catalog.
// The five feature families are always included in our brief and checked on generated melodies:
// rhythmic anticipation, a recognizable hook, a dramatic chorus, a chromatic passing tone,
// and accents/space. Genre changes their relative emphasis, not their presence.
const GENRE={
 'アニソン':{bpm:[125,180],description:'高揚する劇的なサビ、力強い歌唱線、勢いと息継ぎの両立',weights:[2,3,3,1,2]},
 'J-POP':{bpm:[85,155],description:'語感が自然で覚えやすいフック、サビへの滑らかな展開',weights:[2,3,2,1,2]},
 'ジャズ':{bpm:[75,165],description:'シンコペーション、間、色彩的な経過音、会話するような歌メロ',weights:[3,2,1,3,3]},
 'ロック':{bpm:[100,180],description:'歯切れのよい短いモチーフ、強い着地点、サビの解放感',weights:[2,2,3,1,3]},
 'バラード':{bpm:[60,105],description:'息の長い音、余白、情感のある音程推移とサビの頂点',weights:[1,2,3,1,3]},
 'EDM':{bpm:[105,160],description:'反復フックと変奏、裏拍のアクセント、サビのエネルギー',weights:[3,3,2,1,2]},
 'シティポップ':{bpm:[80,125],description:'滑らかな歌唱線、軽い裏拍、洗練された経過音',weights:[2,2,2,3,2]},
 'ボカロ系':{bpm:[115,180],description:'リズムの切れ味と劇的な音程変化、歌唱可能な音域',weights:[3,3,3,2,2]}
};
const features=[
 'リズムの意外性: 8分裏拍で始まる音を含め、次の音への期待を作る',
 '記憶に残るフック: サビ頭の3〜5音に短いモチーフを作り、後で変奏して再登場させる',
 '劇的なサビ: Aメロよりサビの平均音域を上げ、長めの頂点音を1つ以上置く',
 '色彩的な経過音: コード外の半音階的な経過音を少なくとも1回使い、直後に半音で解決する',
 'アクセントと余白: 音価の長短を混ぜ、少なくとも2小節に明確な休符を設ける'
];
export function verifyInput(raw){
 if(!raw||typeof raw!=='object')throw new Error('入力形式が正しくありません');
 const genre=String(raw.genre||'').slice(0,40),theme=String(raw.theme||'').slice(0,160),mood=String(raw.mood||'').slice(0,50);
 const instruments=Array.isArray(raw.instruments)?[...new Set(raw.instruments.filter(x=>INSTRUMENTS.includes(x)))]:[];
 if(!genre||!instruments.length)throw new Error('ジャンルと楽器を指定してください');
 return {genre,theme,mood,instruments,vocalRange:['low','middle','high'].includes(raw.vocalRange)?raw.vocalRange:'middle'};
}
const near=(a,b)=>Math.abs(a-b)<.00001;
function notesInBar(song,b){return song.melody.filter(n=>n.bar===b).sort((a,c)=>a.beat-c.beat);}
// AIの微小な音符ズレ・未割当歌詞を、既存の歌詞を使って補正する。
// 単にエラーを隠さず、修復不能な曲はinspectで拒否する。
export function repairSong(song,input){
 if(!song||!Array.isArray(song.melody)||!Array.isArray(song.lyrics))return song;
 const originalLyrics=new Map(song.lyrics.filter(l=>l&&Number.isInteger(l.bar)).map(l=>[l.bar,typeof l.text==='string'?l.text:'']));
 const all=[];
 for(let bar=0;bar<16;bar++){
  const source=song.melody.filter(n=>n&&Math.round(Number(n.bar))===bar&&Number.isFinite(Number(n.beat))&&Number.isFinite(Number(n.duration))&&Number.isFinite(Number(n.midi)))
   .sort((a,b)=>Number(a.beat)-Number(b.beat));
  const fixed=[];
  let end=0;
  for(const item of source){
   // 再生エンジンの0.5拍グリッドへスナップし、重なりを解消する。
   const rawBeat=Math.round(Number(item.beat)*2)/2;
   const beat=Math.max(0,Math.min(3.5,Math.max(end,rawBeat)));
   if(beat>=4)continue;
   let duration=Math.round(Number(item.duration)*2)/2;
   duration=Math.max(.5,Math.min(duration,4-beat));
   const note={...item,bar,beat,duration,midi:Math.max(45,Math.min(88,Math.round(Number(item.midi)))),lyric:typeof item.lyric==='string'?item.lyric:''};
   fixed.push(note);end=beat+duration;
  }
  if(!fixed.length)continue;
  // 既存の音符断片を優先し、不足があればAIの小節歌詞を使う。
  let syllables=fixed.map(n=>n.lyric.trim());
  const text=originalLyrics.get(bar)||'';
  if(syllables.some(x=>!x)&&text.trim()){
   const chars=Array.from(text.replace(/\s/g,''));
   if(chars.length>=fixed.length){
    syllables=fixed.map((_,i)=>chars.slice(Math.floor(i*chars.length/fixed.length),Math.floor((i+1)*chars.length/fixed.length)).join(''));
   }else if(chars.length){
    syllables=fixed.map((_,i)=>chars[i]||'ー');
   }
  }
  // 歌詞の資料がない無音節音符は、直前母音の延長として扱う。
  if(syllables.some(x=>!x)&&syllables.some(Boolean)){
   syllables=syllables.map((s,i)=>s||(i?'ー':'あ'));
  }
  fixed.forEach((n,i)=>n.lyric=syllables[i]);
  all.push(...fixed);
 }
 song.melody=all;
 // 実際に割り当てられた音符断片の連結を歌詞の正本とする。
 if(all.length&&Array.from({length:16},(_,b)=>all.some(n=>n.bar===b)).every(Boolean)){
  song.lyrics=Array.from({length:16},(_,bar)=>({bar,text:all.filter(n=>n.bar===bar).sort((a,b)=>a.beat-b.beat).map(n=>n.lyric).join('')}));
 }
 return song;
}
function inspect(song,input){
 if(!song||song.bars!==16||!Array.isArray(song.chords)||song.chords.length!==16||!Array.isArray(song.lyrics)||song.lyrics.length!==16)throw Error('歌詞・コードの16小節構成が不正です');
 if(!Number.isInteger(song.bpm)||song.bpm<60||song.bpm>180)throw Error('BPMが範囲外です');
 if(!Array.isArray(song.melody)||song.melody.length<24||song.melody.length>160)throw Error('メロディーの長さが不正です');
 if(!song.melody.every(n=>Number.isInteger(n.bar)&&n.bar>=0&&n.bar<16&&Number.isFinite(n.beat)&&n.beat>=0&&n.beat<4&&near(n.beat*2,Math.round(n.beat*2))&&Number.isFinite(n.duration)&&n.duration>0&&near(n.duration*2,Math.round(n.duration*2))&&n.beat+n.duration<=4.0001&&Number.isInteger(n.midi)&&n.midi>=45&&n.midi<=88&&typeof n.lyric==='string'&&n.lyric.length<=30))throw Error('音符データが不正です');
 if(!song.chords.every(c=>Number.isInteger(c.root)&&c.root>=36&&c.root<=83&&QUALITIES.includes(c.quality)))throw Error('コードが不正です');
 if(!Array.isArray(song.arrangement)||song.arrangement.length!==input.instruments.length||!input.instruments.every(i=>song.arrangement.filter(a=>a.instrument===i).length===1)||!song.arrangement.every(a=>input.instruments.includes(a.instrument)&&PATTERNS.includes(a.pattern)&&Number.isFinite(a.level)&&a.level>=0&&a.level<=1))throw Error('指定楽器と編曲が一致しません');
 for(let bar=0;bar<16;bar++){
  const notes=notesInBar(song,bar);if(!notes.length||notes.some(n=>!n.lyric.trim()))throw Error(`小節${bar+1}の歌詞の割当が不正です`);
  if(notes.some((n,i)=>i>0&&n.beat<notes[i-1].beat+notes[i-1].duration-.0001))throw Error(`小節${bar+1}の主旋律が重複しています`);
  song.lyrics[bar]={bar,text:notes.map(n=>n.lyric).join('')};
 }
 if(typeof song.title!=='string'||song.title.length>80||typeof song.key!=='string')throw Error('楽曲メタデータが不正です');
 return song;
}
// Analyze only observable musical properties; do not claim automated artistic quality scoring.
export function scoreFeatures(song){
 const notes=[...song.melody].sort((a,b)=>a.bar-b.bar||a.beat-b.beat);
 const verse=notes.filter(n=>n.bar<8),chorus=notes.filter(n=>n.bar>=8);
 const mean=x=>x.reduce((s,n)=>s+n.midi,0)/Math.max(x.length,1);
 const anticipated=notes.filter(n=>n.beat%1===.5).length;
 const gapBars=Array.from({length:16},(_,b)=>{const n=notesInBar(song,b);return n.length&& (n[0].beat>.01||n.some((x,i)=>i>0&&x.beat>n[i-1].beat+n[i-1].duration+.001)||n[n.length-1].beat+n[n.length-1].duration<3.99)}).filter(Boolean).length;
 // Motif repeats count exact relative pitch/rhythm fingerprints in chorus, including transposition.
 const motif=(a,i)=>[1,2].map(d=>`${a[i+d].midi-a[i].midi}:${(a[i+d].beat+a[i+d].bar*4)-(a[i].beat+a[i].bar*4)}`).join('|');
 const motifs=new Map();for(let i=0;i+2<chorus.length;i++){const seq=chorus.slice(i,i+3);if(seq[2].bar*4+seq[2].beat-seq[0].bar*4-seq[0].beat>5)continue;const k=motif(chorus,i);motifs.set(k,(motifs.get(k)||0)+1);}
 const hook=[...motifs.values()].some(x=>x>=2);
 const chromatic=notes.some((n,i)=>{if(i<1||i+1>=notes.length)return false;const prev=notes[i-1],next=notes[i+1];return Math.abs(n.midi-prev.midi)===1&&Math.abs(next.midi-n.midi)===1&&n.midi!==next.midi&&Math.abs(next.midi-prev.midi)===2;});
 const longChorus=chorus.some(n=>n.duration>=1.5);
 const chorusLift=mean(chorus)>=mean(verse)+1.5&&longChorus;
 const durations=new Set(notes.map(n=>n.duration));
 return {anticipation:anticipated>=Math.max(3,Math.round(notes.length*.08)),hook,chorusLift,chromatic,space:gapBars>=2&&durations.size>=3,
  details:{anticipated,gapBars,verseMean:mean(verse),chorusMean:mean(chorus),longChorus,motifRepeated:hook}};
}
const ranges={low:'48〜67',middle:'55〜76',high:'60〜81'};
function prompt(input,feedback=''){
 const style=GENRE[input.genre]||GENRE['J-POP'];
 return `あなたは独創的な日本語楽曲の作詞・作曲・編曲家。ALI PROJECT、米津玄師、オーイシマサヨシ、supersellのryo、syudo、ナナホシ管弦楽団といった実在の作曲家の作品や特徴的な旋律を模倣し、下記の抽象的な音楽技法を組み合わせて完全な新曲を作る。\nジャンル:${input.genre}、指針:${style.description}。\n【すべての曲に入れる5要素】${features.map((f,i)=>`\n${i+1}. ${f}（重点${style.weights[i]}/3）`).join('')}\nジャンルらしさは旋律そのものにも表す。\n【必須データ】4/4拍子16小節、0〜7がAメロ、8〜15がサビ。全小節に歌詞・メロディー・1コード。BPMは${style.bpm[0]}〜${style.bpm[1]}。主旋律は計32〜96音で各小節2〜6音程度。開始beat=0,0.5,...3.5、duration=0.5,1,1.5,2、beat+duration<=4。重なるメロディー音は禁止。休符は音符の隙間で表現する。\n【歌詞一致は最優先】melodyの各音符にlyricを設定し、1音符につき歌える短い日本語断片を付す。各小節の音符をbeat順に並べてlyricを連結したものをlyrics.textにも設定。拗音や促音は前後と自然につなげる。音域はMIDI ${ranges[input.vocalRange]}を原則とし歌いやすく。サビはAメロより高揚し2拍近い頂点音を置く。\nコードは16個、root MIDI36〜83、qualityはmajor/minor/dom7/sus4。arrangementは指定楽器のみを一度ずつ含める。patternはpulse/arpeggio/strum/pad/groove。16小節を通じた単純反復は避ける。歌詞とメロディーと和声の整合性を優先。\n${feedback}`;
}
async function askAI(input,env,task,feedback){
 const response=await fetch('https://api.openai.com/v1/chat/completions',{
 method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
 body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',temperature:.8,max_completion_tokens:7500,
  messages:[{role:'system',content:prompt(input,feedback)},{role:'user',content:`ジャンル:${input.genre}; 希望楽器:${input.instruments.join(',')}; テーマ:${input.theme||'自由'}; 雰囲気:${input.mood||'自由'}; 歌唱音域:${input.vocalRange}。${task}`}],
  response_format:{type:'json_schema',json_schema:{name:'vtusong_song',strict:true,schema}}})});
 if(!response.ok){const detail=await response.text();throw Error(`AI API (${response.status}): ${detail.slice(0,220)}`);}
 const data=await response.json();if(data.choices?.[0]?.finish_reason==='length')throw Error('AIの出力が上限で中断されました');
 const content=data.choices?.[0]?.message?.content;if(!content)throw Error('AIが楽曲を返しませんでした');
 return inspect(repairSong(JSON.parse(content),input),input);
}
export async function createSong(input,env,revision=null){
 if(!env.OPENAI_API_KEY)throw Error('サーバー側のOPENAI_API_KEYが未設定です');
 const hints={lyrics:'歌詞のみ変更。元の音符数と配置を変えず各音符のlyricのみ変更する。',melody:'コード進行と編曲を変えず、歌詞と対応した主旋律を再作曲する。',arrangement:'楽器パターンと音量のみ変更する。',chorus:'後半8小節の歌詞・主旋律・コードだけ変更する。'};
 if(revision&&!hints[revision.mode])throw Error('再生成モードが不正です');
 const task=revision?`既存曲の部分修正：${hints[revision.mode]} 既存JSON=${JSON.stringify(revision.song)}`:'新規オリジナル曲を制作。';
 let best=null,bestCount=-1,lastError=null;
 // One initial generation and at most one quality-focused retry: bounded API cost.
 for(let attempt=0;attempt<2;attempt++){
  const feedback=attempt===0?'':`前回の生成で次を修正してください: ${lastError||'サビの上昇、裏拍、フック、半音経過音、休符'}。16小節すべての音符にlyricが必要です。空欄禁止。beatとdurationは0.5刻みで重複禁止。`;
  try{
   const proposed=await askAI(input,env,task,feedback);
   let candidate=proposed;
   if(revision){
    const old=revision.song;
    candidate={...old};
    switch(revision.mode){
     case 'lyrics': {candidate.melody=old.melody.map(n=>({...n}));for(let bar=0;bar<16;bar++){const a=candidate.melody.filter(n=>n.bar===bar).sort((x,y)=>x.beat-y.beat), b=proposed.melody.filter(n=>n.bar===bar).sort((x,y)=>x.beat-y.beat);const text=b.map(n=>n.lyric).join('')||proposed.lyrics[bar]?.text||'';const chars=Array.from(text);if(!chars.length)continue;a.forEach((n,i)=>{const start=Math.floor(i*chars.length/a.length),end=Math.floor((i+1)*chars.length/a.length);n.lyric=chars.slice(start,end).join('')||'ー';});}candidate.lyrics=old.lyrics;break;}
     case 'melody':candidate.melody=proposed.melody;candidate.lyrics=proposed.lyrics;break;
     case 'arrangement':candidate.arrangement=proposed.arrangement;break;
     case 'chorus':candidate.melody=[...old.melody.filter(n=>n.bar<8),...proposed.melody.filter(n=>n.bar>=8)];candidate.lyrics=old.lyrics;candidate.chords=old.chords.map((ch,i)=>i<8?ch:proposed.chords[i]);break;
    }
    inspect(candidate,input);
   }
   const scores=scoreFeatures(candidate);const misses=Object.entries(scores).filter(([k,v])=>k!=='details'&&!v).map(([k])=>k);
   if(misses.length<5-bestCount){best=candidate;bestCount=5-misses.length;}
   if(revision||misses.length===0)return candidate;
   lastError=misses.join(', ');
  }catch(e){lastError=e?.message||'不明なエラー';if(attempt===1&&!best)throw e;}
 }
 // Prefer returning a valid song rather than falsely claiming hard guarantees about quality.
 if(!best)throw Error(lastError||'生成データの検証に失敗しました');
 return best;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{headers});
 if(url.pathname==='/health')return json({ok:true,service:'VTuSONG AI',styleEngine:'v4.1'});
 if(!['/api/generate','/api/revise'].includes(url.pathname))return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'POST only'},405);
 if(Number(request.headers.get('Content-Length')||0)>32768)return json({error:'入力が長すぎます'},413);
 let input,revision=null;
 try{const body=await request.json();input=verifyInput(body.input??body);if(url.pathname==='/api/revise'){
  if(!['lyrics','melody','arrangement','chorus'].includes(body.mode))throw Error('修正対象が不正です');
  revision={mode:body.mode,song:inspect(body.song,input)};
 }}catch(e){return json({error:e.message},400);}
 try{return json({song:await createSong(input,env,revision)});}
 catch(e){console.error('song generation failed',e?.message);return json({error:'AI生成に失敗しました。少し条件を変えて再試行してください。',detail:String(e?.message||'').slice(0,160)},502);}
}};
