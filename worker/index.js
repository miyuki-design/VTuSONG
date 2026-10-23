// VTuSONG genre-sensitive songwriting engine — replaces worker/index.js.
const INSTRUMENTS = ['piano','guitar','bass','drums','strings','synth'];
const PATTERNS = ['pulse','arpeggio','strum','pad','groove'];
const QUALITIES = ['major','minor','dom7','sus4'];
const object = properties => ({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const schema = object({
  title:{type:'string'},genre:{type:'string'},theme:{type:'string'},mood:{type:'string'},
  key:{type:'string'},bpm:{type:'integer'},bars:{type:'integer'},
  lyrics:{type:'array',items:object({bar:{type:'integer'},text:{type:'string'}})},
  chords:{type:'array',items:object({root:{type:'integer'},quality:{type:'string',enum:QUALITIES}})},
  melody:{type:'array',items:object({bar:{type:'integer'},beat:{type:'number'},duration:{type:'number'},midi:{type:'integer'}})},
  arrangement:{type:'array',items:object({instrument:{type:'string',enum:INSTRUMENTS},pattern:{type:'string',enum:PATTERNS},level:{type:'number'}})}
});
const jsonHeaders = {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});
const GENRE = {
  'アニソン': `【アニソン専用・最優先】疾走感と歌いたくなるサビ。イントロの代わりにAメロ1〜8小節は音域を抑えた語りかける旋律、9〜16小節では明確に音域を上げ、長めの頂点音を置く。サビ頭の印象的な3〜5音のフックを反復・変形。音価に緩急を付け、同じ長さの音符の羅列を避ける。拍頭に強い音が来る箇所と食う箇所を組み合わせる。明るい王道なら長調でIV–V–iii–vi等の情緒ある動き、熱い曲なら短調や借用感も活用。ただし無理な高音の連発は避ける。母音が伸ばしやすい日本語をサビのロングトーンに。`,
  'J-POP': `親しみやすい歌唱フレーズ、反復と少しの意外性。Aメロは会話調、サビは順次進行と適度な跳躍で記憶に残る。短長音を交えフレーズ末尾に休符を置く。`,
  'ジャズ': `歌うジャズ。シンコペーションで拍裏から入る音を多くし、休符と長短を大胆に対比させる。ブルーノート相当の♭3/♭5/♭7等を通過音として取り入れ、コードトーンへ自然に解決する。滑らかな短いフレーズと間を作る。半拍単位の範囲でも裏拍を積極的に使う。`,
  'ロック': `力強い短い反復モチーフ、言葉のアクセントを利かせた音程、大きめの跳躍はサビで限定的に。Aメロは低めで歯切れよく、サビは解放感のある伸ばす音とコール風フック。`,
  'バラード': `ゆったりした息の長い歌唱線、1～2拍の音を有効活用。Aメロは音数を絞りサビで高揚。休符と終止の余韻を大切にして歌詞の意味を優先。`,
  'EDM': `短い強いフックを中心に、短音の反復とサビの音域上昇を組み合わせる。反復だけにならないよう、4小節ごとに着地点を変える。`,
  'シティポップ': `軽いシンコペーション、都会的で滑らかな旋律、9th/7thを感じる経過音とコードに沿うメロディー。音を詰め込みすぎず、リズムで洒落た雰囲気を出す。`,
  'ボカロ系': `速い言葉の譜割りを意識しながらも実際に人間が歌える範囲。跳躍、音程の反復、半拍単位の畳み掛けを組み合わせ、サビ頭に明確なフックを置く。`
};
export function verifyInput(raw){
 if(!raw||typeof raw!=='object') throw new Error('入力形式が正しくありません');
 const genre=String(raw.genre||'').slice(0,40),theme=String(raw.theme||'').slice(0,160),mood=String(raw.mood||'').slice(0,50);
 const vocalRange=['low','middle','high'].includes(raw.vocalRange)?raw.vocalRange:'middle';
 const instruments=Array.isArray(raw.instruments)?[...new Set(raw.instruments.filter(i=>INSTRUMENTS.includes(i)))]:[];
 if(!genre||!instruments.length)throw new Error('ジャンルと楽器を指定してください');
 return {genre,theme,mood,vocalRange,instruments};
}
function validate(song,input){
 if(!song||song.bars!==16||!Array.isArray(song.chords)||song.chords.length!==16||!Array.isArray(song.lyrics)||song.lyrics.length!==16)throw new Error('歌詞またはコードの小節数が不足しています');
 if(!Number.isInteger(song.bpm)||song.bpm<60||song.bpm>180)throw new Error('BPMが範囲外です');
 if(!Array.isArray(song.melody)||song.melody.length<24||song.melody.length>160)throw new Error('メロディーが不完全です');
 if(!song.melody.every(n=>Number.isInteger(n.bar)&&n.bar>=0&&n.bar<16&&Number.isFinite(n.beat)&&n.beat>=0&&n.beat<4&&Number.isFinite(n.duration)&&n.duration>0&&n.beat+n.duration<=4.001&&Number.isInteger(n.midi)&&n.midi>=45&&n.midi<=88))throw new Error('音符データの検証に失敗しました');
 if(!song.chords.every(c=>Number.isInteger(c.root)&&c.root>=36&&c.root<=83&&QUALITIES.includes(c.quality)))throw new Error('コードデータの検証に失敗しました');
 if(!song.lyrics.every(l=>Number.isInteger(l.bar)&&l.bar>=0&&l.bar<16&&typeof l.text==='string'))throw new Error('歌詞データの検証に失敗しました');
 if(!Array.isArray(song.arrangement)||song.arrangement.length!==input.instruments.length||!input.instruments.every(i=>song.arrangement.some(a=>a.instrument===i))||!song.arrangement.every(a=>input.instruments.includes(a.instrument)&&PATTERNS.includes(a.pattern)&&Number.isFinite(a.level)&&a.level>=0&&a.level<=1))throw new Error('楽器選択が正しく反映されていません');
 if(typeof song.title!=='string'||song.title.length>80)throw new Error('タイトルデータが不正です');
 return song;
}
const rhythmGuide = `再生側は4/4、16小節、各小節4拍。音符はbeat=0/0.5/1/1.5/2/2.5/3/3.5、duration=0.5/1/1.5/2（拍単位）から選ぶ。beat+duration<=4。各小節の音数は2〜6を目安とし、全体は32〜96音。休符は音符間の隙間で表す。開始beatのパターン、長短、フレーズ末尾の休符をジャンルごとに変化させる。`;
function rangeOf(x){return x==='low'?'MIDI 48〜67 (C3〜G4)':x==='high'?'MIDI 60〜81 (C4〜A5)':'MIDI 55〜76 (G3〜E5)';}
function promptFor(input){
 const style=GENRE[input.genre]||GENRE['J-POP'];
 return `あなたはジャンルの様式を理解したプロの作詞家・作曲家・編曲家。単なるポップスのテンプレート化は禁止。指示されたジャンルの「主旋律だけ」を聴いても判別できるよう作曲する。既存作品のメロディー・歌詞は模倣しない。\n\n【今回のジャンル】${input.genre}\n${style}\n\n【厳守するデータ仕様】\n歌詞は小節0〜15の16行、コードは16個を順番に並べる。Aメロは0〜7、サビは8〜15。各小節に主旋律の音を配置する。${rhythmGuide}\n音域は${rangeOf(input.vocalRange)}を原則とし、跳躍は歌いやすく。コードrootはMIDI48〜71程度、qualityはmajor/minor/dom7/sus4のいずれか。コード進行に沿い旋律を成立させる。\n歌詞は各小節が短い日本語のフレーズ。音符と日本語モーラを厳密に結びつけるデータはまだないので、不自然に文字数を詰め込みすぎず、4拍の歌として無理のない量にする。サビの長音には伸ばしやすい語尾を選ぶ。\narrangementは指定された楽器だけを1回ずつ入れる。instrumentは指定英名、patternはpulse/arpeggio/strum/pad/groove、levelは0〜1。テンポはBPM60〜180。16小節固定。全部のフィールドを返し、余計なフィールドは付けない。\n一様なメロディー、全小節同じリズム、コード進行の機械的な繰り返しを避ける。譜割り、反復フック、休符、サビの音域、フレーズ単位でジャンルらしい展開を作る。`;
}
export async function createSong(input,env,revision=null){
 if(!env.OPENAI_API_KEY)throw new Error('サーバー側のOPENAI_API_KEYが未設定です');
 const hints={lyrics:'歌詞のみ変更。元のメロディーの拍数に合わせ短く歌える語句にする。',melody:'メロディーのみ変更。選んだジャンルを主旋律で明確に表す。元の歌詞とコードを尊重。',arrangement:'編曲パターンとレベルのみ変更。',chorus:'後半8小節の歌詞・メロディー・コードのみ変更。ジャンルらしい強いサビに。'};
 const task=revision?`既存楽曲の変更対象：${hints[revision.mode]}。ほかの部分は極力残す。元楽曲：${JSON.stringify(revision.song)}`:'新規オリジナル楽曲を制作。ジャンルと歌唱可能性を最優先。';
 const response=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',temperature:.85,max_completion_tokens:7500,
   messages:[{role:'system',content:promptFor(input)},{role:'user',content:`ジャンル=${input.genre}\n楽器=${input.instruments.join(', ')}\nテーマ=${input.theme||'自由'}\n雰囲気=${input.mood||'自由'}\n歌唱音域=${rangeOf(input.vocalRange)}\n${task}`}],
   response_format:{type:'json_schema',json_schema:{name:'vtusong_song',strict:true,schema}}})
 });
 if(!response.ok){const problem=await response.text();throw new Error(`AI API (${response.status}): ${problem.slice(0,250)}`);}
 const data=await response.json();const content=data?.choices?.[0]?.message?.content;
 if(!content)throw new Error(`AI応答が空です (${data?.choices?.[0]?.finish_reason||'unknown'})`);
 const next=JSON.parse(content);
 if(!revision)return validate(next,input);
 const old=revision.song;const song={...old};
 switch(revision.mode){
  case 'lyrics': song.lyrics=next.lyrics;break;
  case 'melody': song.melody=next.melody;break;
  case 'arrangement':song.arrangement=next.arrangement;break;
  case 'chorus':
   song.lyrics=[...old.lyrics.filter(l=>l.bar<8),...next.lyrics.filter(l=>l.bar>=8)];
   song.melody=[...old.melody.filter(n=>n.bar<8),...next.melody.filter(n=>n.bar>=8)];
   song.chords=old.chords.map((c,i)=>i>=8?next.chords[i]:c);break;
  default:throw new Error('再生成モードが不正です');
 }
 return validate(song,input);
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{headers:jsonHeaders});
 if(url.pathname==='/health')return json({ok:true,service:'VTuSONG AI',genreEngine:'v2'});
 if(!['/api/generate','/api/revise'].includes(url.pathname))return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'POST only'},405);
 if(Number(request.headers.get('Content-Length')||0)>32768)return json({error:'入力が長すぎます'},413);
 let input,revision=null;
 try{
  const body=await request.json();input=verifyInput(body.input??body);
  if(url.pathname==='/api/revise'){
   if(!['lyrics','melody','arrangement','chorus'].includes(body.mode))throw new Error('修正対象が不正です');
   revision={mode:body.mode,song:validate(body.song,input)};
  }
 }catch(e){return json({error:e.message},400);}
 try{return json({song:await createSong(input,env,revision)});}
 catch(e){console.error('song generation failed',e?.message);return json({error:'AI生成に失敗しました。少し条件を変えて再試行してください。',detail:String(e?.message||'').slice(0,160)},502);}
}};
