import {expect,test} from 'bun:test';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createInstance} from '../addons/customer-support-isolated/instance.ts';
test('support tools and page share persistent records without crossing employee directories',async()=>{
 const root=mkdtempSync(join(tmpdir(),'haiqiai-support-'));
 const context=(id:string)=>({dataDir:join(root,id),ownerId:id,instanceId:id});
 for(const id of ['a','b'])mkdirSync(join(root,id));
 try{
  const a=createInstance(context('a')),b=createInstance(context('b'));
  a.tools[0]!.execute({action:'create',customer:'A',title:'A-only'});
  expect(await(await a.request(new Request('http://fixture/'))).json()).toMatchObject({stats:{total:1},tickets:[{title:'A-only'}]});
  expect(await(await b.request(new Request('http://fixture/'))).json()).toMatchObject({stats:{total:0}});
  await a.request(new Request('http://fixture/close',{method:'POST',body:JSON.stringify({id:'CS-0001'})}));
  expect(createInstance(context('a')).tools[0]!.execute({action:'list'})).toMatchObject({details:{value:[{title:'A-only',status:'resolved'}]}});
 }finally{rmSync(root,{recursive:true,force:true});}
});
