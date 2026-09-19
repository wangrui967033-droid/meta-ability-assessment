import {execFileSync} from 'node:child_process'
import {mkdirSync,cpSync,writeFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'

const root=fileURLToPath(new URL('..',import.meta.url))
const stamp=new Date().toISOString().replace(/[:.]/g,'-')
const release=join(root,'oss-release',stamp)
const project=join(release,'projects','meta-ability-assessment')
// The URL is public configuration, not an API key. No service key or password goes into Vite.
const env={...process.env,VITE_ASSESSMENT_API_URL:'https://xldjstqwqydcohsebnde.supabase.co/functions/v1/assessment-api'}
execFileSync('pnpm',['run','build:deployment'],{cwd:root,env,stdio:'inherit'})
mkdirSync(project,{recursive:true})
cpSync(join(root,'dist'),project,{recursive:true,filter:path=>!path.endsWith('.DS_Store')})
mkdirSync(join(project,'admin'),{recursive:true})
writeFileSync(join(project,'admin','index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>测评管理端</title><meta http-equiv="refresh" content="0;url=../index.html#/admin"><a href="../index.html#/admin">进入管理端</a></html>')
const archive=join(root,'oss-release',`meta-ability-assessment-${stamp}.zip`)
if(existsSync(archive))throw Error('Refusing to overwrite an existing release')
execFileSync('/usr/bin/zip',['-qr',archive,'projects'],{cwd:release,stdio:'inherit'})
console.log('OSS package:',archive)
console.log('Static root:',release)
