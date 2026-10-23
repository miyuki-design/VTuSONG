import test from 'node:test'
import assert from 'node:assert/strict'
import handler,{verifyInput,createSong,scoreFeatures} from './index.js'
const input={genre:'アニソン',instruments:['piano','drums'],theme:'旅立ち',mood:'力強い',vocalRange:'middle'}
test('input validation',()=>{assert.deepEqual(verifyInput({...input,instruments:['piano','piano','drums']}).instruments,['piano','drums']);assert.throws(()=>verifyInput({...input,instruments:[]}));})
test('health endpoint',async()=>{const r=await handler.fetch(new Request('https://test.local/health'),{});assert.equal((await r.json()).styleEngine,'v4')})
test('missing api key',async()=>{await assert.rejects(()=>createSong(input,{}),/OPENAI_API_KEY/)})
test('rejected route',async()=>{const r=await handler.fetch(new Request('https://test.local/nope'),{});assert.equal(r.status,404)})
test('quality diagnostic reports deficits rather than inventing guarantees',()=>{
 const song={melody:[]};for(let b=0;b<16;b++)for(let x=0;x<4;x++)song.melody.push({bar:b,beat:x,duration:1,midi:60,lyric:'あ'});
 const q=scoreFeatures(song);assert.equal(q.anticipation,false);assert.equal(q.hook,true);assert.equal(q.chorusLift,false);assert.equal(q.chromatic,false);assert.equal(q.space,false);
})
