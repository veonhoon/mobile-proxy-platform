/**
 * Mobile Proxy Test Script
 * 
 * Usage:
 *   node test-proxy.js
 *   node test-proxy.js https://api.ipify.org?format=json
 * 
 * Proxy: localhost:9001
 * Auth:  proxy:proxy123
 */

const http = require('http');
const url = require('url');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 9001;
const PROXY_USER = 'proxy';
const PROXY_PASS = 'proxy123';

function requestViaProxy(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    
    const options = {
      host: PROXY_HOST,
      port: PROXY_PORT,
      path: targetUrl,
      method: 'GET',
      headers: {
        'Host': parsed.hostname,
        'Proxy-Authorization': 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64'),
        'User-Agent': 'MobileProxyTest/1.0',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

async function main() {
  const targetUrl = process.argv[2] || 'http://httpbin.org/ip';
  
  console.log(`Testing proxy at ${PROXY_HOST}:${PROXY_PORT}`);
  console.log(`Target: ${targetUrl}\n`);

  try {
    const result = await requestViaProxy(targetUrl);
    console.log(`Status: ${result.statusCode}`);
    console.log(`Response:\n${result.body}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
