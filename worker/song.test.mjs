import test from 'node:test'
import assert from 'node:assert/strict'
import handler,{verifyInput,createSong} from './index.js'
const valid={genre:'J-POP',instruments:['piano','bass','drums'],theme:'旅',mood:'爽やか',vocalRange:'middle'}
test('入力のバリデーションと楽器の重複除去',()=>{
  assert.deepEqual(verifyInput({...valid,instruments:['piano','piano','drums','invalid']}).instruments,['piano','drums'])
  assert.throws(()=>verifyInput({...valid,instruments:[]}))
})
test('health check',async()=>{
  const res=await handler.fetch(new Request('https://fake.test/health'),{})
  assert.deepEqual(await res.json(),{ok:true,service:'VTuSONG AI'})
})
test('unknown route',async()=>{
  const res=await handler.fetch(new Request('https://fake.test/unknown'),{})
  assert.equal(res.status,404)
})
test('AI rejects empty api key',async()=>{
  await assert.rejects(()=>createSong(valid,{}),/OPENAI_API_KEY/)
})
