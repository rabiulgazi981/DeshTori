const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire(require.resolve('../apps/api/package.json'));
const { Module, ValidationPipe } = req('@nestjs/common');
const { NestFactory, Reflector } = req('@nestjs/core');
const { JwtService } = req('@nestjs/jwt');
const cookieParser = req('cookie-parser');
const { ConfigController, DEFAULT_APPEARANCE } = require('../apps/api/dist/admin/config.controller');
const { IntegrationsService } = require('../apps/api/dist/integrations/integrations.service');
const { ProductsService } = require('../apps/api/dist/products/products.service');
const { PrismaService } = require('../apps/api/dist/prisma/prisma.service');
const { AuditService } = require('../apps/api/dist/prisma/audit.service');
const { JwtAuthGuard, RolesGuard } = require('../apps/api/dist/auth/guards');
test('HTTP endpoints validate input, restrict Owner writes, persist and redact configuration', async () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'http-tests-only-32-character-secret';
  const records = new Map(); const logs = [];
  const prisma = { setting: {
    findUnique: async ({where}) => records.get(where.key) || null,
    upsert: async ({where,create,update}) => { const value = records.has(where.key) ? {...records.get(where.key),...update} : create; records.set(where.key,value); return value; },
  }, product: { updateMany: async () => ({count:0}) }, session: { findUnique: async () => ({revokedAt:null,expiresAt:new Date(Date.now()+60000)}) } };
  const audit = {log:async value=>logs.push(value)};
  const jwt = new JwtService({secret:'http-test-jwt-key'});
  class TestModule {}
  Module({controllers:[ConfigController],providers:[
    {provide:PrismaService,useValue:prisma},{provide:AuditService,useValue:audit},
    {provide:IntegrationsService,useValue:new IntegrationsService(prisma,audit)},
    {provide:ProductsService,useValue:{search:async()=>({items:[{id:'mock'}]})}},
    {provide:JwtService,useValue:jwt},Reflector,JwtAuthGuard,RolesGuard,
  ]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});
  app.use(cookieParser());app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const token=(kind,roles)=>jwt.sign({id:kind,kind,roles,sid:'test-session'});
  const owner=token('STAFF',['OWNER']),staff=token('STAFF',['CN_PURCHASE']),customer=token('CUSTOMER',[]);
  const call=async(path,method='GET',body,auth)=>{const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(auth?{Cookie:'dt_session='+auth}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
  try {
    assert.equal((await call('/admin/integrations')).status,401);
    assert.equal((await call('/admin/integrations','GET',undefined,customer)).status,403);
    assert.equal((await call('/admin/integrations','GET',undefined,staff)).status,403);
    assert.equal((await call('/admin/integrations','GET',undefined,owner)).status,200);
    let r=await call('/admin/integrations/products','PUT',{values:{provider:'mock',apiKey:'http-secret-key',cacheMinutes:'60'}},owner);
    assert.equal(r.status,200);assert.equal(r.body.configured.apiKey,true);assert.equal(JSON.stringify(r).includes('http-secret-key'),false);
    assert.equal(JSON.stringify([...records.values()]).includes('http-secret-key'),false);
    assert.equal((await call('/admin/integrations/products','PUT',{values:{provider:'invalid'}},owner)).status,400);
    assert.equal((await call('/admin/integrations/products','PUT',{values:{apiKey:123}},owner)).status,400);
    assert.equal((await call('/admin/appearance','PUT',DEFAULT_APPEARANCE,customer)).status,403);
    assert.equal((await call('/admin/appearance','PUT',{...DEFAULT_APPEARANCE,primary:'red'},owner)).status,400);
    assert.equal((await call('/admin/appearance','PUT',{...DEFAULT_APPEARANCE,headerLogo:'javascript:alert(1)'},owner)).status,400);
    const appearance={...DEFAULT_APPEARANCE,primary:'#123456',defaultTheme:'system',showMobileNav:false};
    assert.equal((await call('/admin/appearance','PUT',appearance,owner)).status,200);
    assert.deepEqual((await call('/appearance')).body,appearance);
    assert.equal(JSON.stringify(logs).includes('http-secret-key'),false);
  } finally { await app.close(); }
});
