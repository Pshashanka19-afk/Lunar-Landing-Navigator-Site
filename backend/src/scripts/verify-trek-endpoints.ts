import { app } from '../app';
import { EventEmitter } from 'events';

function dispatchMockRequest(
  method: 'GET' | 'POST',
  url: string
): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter() as any;
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { 'content-type': 'application/json' };
    req.query = {};
    req.params = {};
    req.body = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    req.get = (header: string) => req.headers[header.toLowerCase()];
    req.header = req.get;

    let resStatus = 200;
    const resHeaders: Record<string, string> = {};
    let rawChunks: Buffer[] = [];

    const res = new EventEmitter() as any;
    res.statusCode = 200;
    res.status = (code: number) => {
      resStatus = code;
      res.statusCode = code;
      return res;
    };
    res.set = (keyOrObj: string | Record<string, string>, val?: string) => {
      if (typeof keyOrObj === 'string') {
        resHeaders[keyOrObj.toLowerCase()] = String(val);
      } else {
        Object.entries(keyOrObj).forEach(([k, v]) => {
          resHeaders[k.toLowerCase()] = String(v);
        });
      }
      return res;
    };
    res.setHeader = res.set;
    res.getHeader = (name: string) => resHeaders[name.toLowerCase()];

    res.write = (chunk: any) => {
      if (chunk) {
        rawChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    };

    res.send = (body: any) => {
      let parsed = body;
      if (typeof body === 'string') {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
      }
      resolve({ status: resStatus, headers: resHeaders, body: parsed });
      return res;
    };

    res.json = (jsonBody: any) => {
      resHeaders['content-type'] = 'application/json';
      resolve({ status: resStatus, headers: resHeaders, body: jsonBody });
      return res;
    };

    res.end = (chunk?: any) => {
      if (chunk) {
        rawChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const combined = Buffer.concat(rawChunks).toString('utf-8');
      let parsed: any = combined;
      try {
        parsed = JSON.parse(combined);
      } catch {
        // text/xml or string
      }
      resolve({ status: resStatus, headers: resHeaders, body: parsed });
      return res;
    };

    try {
      (app as any).handle(req, res, (err: any) => {
        if (err) reject(err);
        else resolve({ status: 404, headers: resHeaders, body: 'Not Found' });
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function run() {
  console.log('Testing NASA Moon Trek Endpoints...');

  const layersRes = await dispatchMockRequest('GET', '/api/v1/trek/layers');
  console.log(`GET /api/v1/trek/layers: status = ${layersRes.status}, count = ${layersRes.body?.count}`);
  if (layersRes.status !== 200 || !layersRes.body?.layers?.length) {
    throw new Error('Failed to retrieve layers');
  }

  const capRes = await dispatchMockRequest('GET', '/api/v1/trek/capabilities/LRO_WAC_Mosaic_Global_303ppd_v02');
  console.log(`GET /api/v1/trek/capabilities/LRO_WAC_Mosaic_Global_303ppd_v02: status = ${capRes.status}, isXml = ${typeof capRes.body === 'string' && capRes.body.includes('<Capabilities')}`);
  if (capRes.status !== 200 || !capRes.body.includes('<Capabilities')) {
    throw new Error('Failed to retrieve capabilities XML');
  }

  console.log('NASA Moon Trek Endpoints verified successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

