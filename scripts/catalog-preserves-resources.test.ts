import {expect,test} from 'bun:test';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('catalog synchronization preserves independently maintained skills',async()=>{
 const root=mkdtempSync(join(tmpdir(),'haiqiai-catalog-sync-'));
 try {
  mkdirSync(join(root,'scripts'),{recursive:true});
  cpSync(join(import.meta.dir,'sync-catalog.ts'),join(root,'scripts/sync-catalog.ts'));
  cpSync(join(import.meta.dir,'lib'),join(root,'scripts/lib'),{recursive:true});
  const addon=join(root,'addons','probe');mkdirSync(addon,{recursive:true});
  writeFileSync(join(addon,'index.ts'),'export default function(){}');
  writeFileSync(join(addon,'package.json'),JSON.stringify({name:'@qiushuiai/qiushuiai-addon-probe',version:'1.0.0',description:'测试插件',keywords:['pi-package'],pi:{extensions:['index.ts']},qiushuiai:{displayName:'测试插件',type:'extension',compatibleVersions:'>=3.0.0',categories:['test'],displayTags:['测试'],featured:false}}));
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'probe',version:'1.0.0'}));
  writeFileSync(join(root,'catalog.json'),JSON.stringify({version:3,source:'github:benjamin-qhy/qiushui-addons',addons:[]}));
  const skill=join(root,'skills','independent');mkdirSync(skill,{recursive:true});writeFileSync(join(skill,'SKILL.md'),'preserve source bytes');
  const processResult=Bun.spawn([process.execPath,join(root,'scripts/sync-catalog.ts'),'--write'],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const err=await new Response(processResult.stderr).text();
  expect(await processResult.exited,err).toBe(0);
  expect(readFileSync(join(skill,'SKILL.md'),'utf8')).toBe('preserve source bytes');
 } finally {rmSync(root,{recursive:true,force:true});}
});
