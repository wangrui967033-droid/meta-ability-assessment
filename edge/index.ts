import {createHandler} from './handler'
import {Backend, type EdgeConfig} from './backend'
declare const Deno: {env:{get(name:string):string|undefined}; serve(handler:(r:Request)=>Promise<Response>):void}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}
const config: EdgeConfig = {
  url:required('SUPABASE_URL'),key:required('SUPABASE_SERVICE_ROLE_KEY'),
  projectKey: Deno.env.get('ASSESSMENT_PROJECT_KEY') || 'meta-ability-assessment',
  origin:Deno.env.get('APP_ORIGIN') || 'http://sishu.ray.xshq0521.cn',
  phoneEncryptionKey:Deno.env.get('PHONE_ENCRYPTION_KEY') || '',phoneLookupSecret:Deno.env.get('PHONE_LOOKUP_SECRET') || '',
}
if (new URL(config.origin).origin !== config.origin || !/^https?:\/\//.test(config.origin)) throw new Error('APP_ORIGIN must be an HTTP(S) origin')
if (!/^https:\/\/[a-z0-9.-]+$/.test(config.url) || !/^[a-z][a-z0-9-]{2,62}$/.test(config.projectKey)) throw new Error('Invalid backend configuration')
let handler: ReturnType<typeof createHandler> | undefined
let initializing: Promise<void> | undefined
Deno.serve(async req => {
  try {
    if (!handler) {
      initializing ??= (async () => {
        if (!config.phoneEncryptionKey || !config.phoneLookupSecret) {
          const stored = await new Backend(config).rpc('assessment_runtime_config',{})
          config.phoneEncryptionKey ||= stored.phoneEncryptionKey
          config.phoneLookupSecret ||= stored.phoneLookupSecret
        }
        if (config.phoneEncryptionKey.length < 32 || config.phoneLookupSecret.length < 32) throw new Error('Missing encryption configuration')
        handler=createHandler(new Backend(config))
      })()
      await initializing
    }
    return await handler!(req)
  } catch {
    initializing=undefined
    return new Response(JSON.stringify({error:{code:'unavailable',message:'服务暂时不可用，请稍后重试'}}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
  }
})
