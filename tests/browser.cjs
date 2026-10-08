const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let playwright;try{playwright=require('playwright')}catch{playwright=require(process.env.DNT_NODE_MODULES+'/playwright')}
exports.inGame=async fn=>{
 const root=path.resolve(__dirname,'..'),base=process.env.DNT_BASE_PATH||'/',server=http.createServer((req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!url.startsWith(base))throw Error('prefix');let f=path.resolve(root,url.slice(base.length));if(f!==root&&!f.startsWith(root+path.sep))throw Error('path');if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))}catch{res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await playwright.chromium.launch({headless:true,...(process.env.DNT_BROWSER?{executablePath:process.env.DNT_BROWSER}:{})});
 try{const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}${base}`);await page.waitForTimeout(1400);return await fn(page,errors)}finally{await browser.close();server.close()}
};
