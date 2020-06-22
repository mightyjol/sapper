import { createProxyMiddleware } from 'http-proxy-middleware';
import { Handler, Req, Res } from './types';
import build_info from './build_info';
import { build_dir, dev, src_dir } from '@sapper/internal/manifest-server';

export default function handler () {
  const dev = process.env.NODE_ENV === 'development';
  
  if (dev && build_info.bundler === 'snowpack') {
    const snowpackMiddleware = createProxyMiddleware({ target: 'http://localhost:8080/', changeOrigin: true })
    const snowpackRoutes = [ 'web_modules', 'client', '__snowpack__' ]
    const snowpackRoutesRegEx = new RegExp(`\/${snowpackRoutes.join('|\/')}`)
    
    return (req: Req, res: Res, next: () => void) => {
      if (req.path === '/__snowpack__/hmr.js') { // This route if you want to use sapper service worker to reload the page
        res.setHeader('Content-type', 'application/javascript; charset=utf-8')
        res.end('export function createHotContext(fullUrl) { console.log(`[ESM-HMR] ignore snowpack hmr for ${ fullUrl } (because we still have to build the service worker; hmr will be utilized server side)`); return { accept: function() {}, dispose: function() {} } }')
        return;
      }
      if (snowpackRoutesRegEx.test(req.path)) {
        snowpackMiddleware(req, res, next);
        return;
      }
      next()
    }
  }
}