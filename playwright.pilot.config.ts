import { defineConfig, devices } from '@playwright/test';
const baseURL=process.env.PILOT_BASE_URL;
if(!baseURL) throw new Error('PILOT_BASE_URL is required for pilot smoke tests.');
const url=new URL(baseURL);
if(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname)||url.hostname.endsWith('.trycloudflare.com')) throw new Error('Pilot smoke tests require a stable HTTPS origin.');
export default defineConfig({testDir:'./e2e/pilot',workers:1,fullyParallel:false,retries:0,reporter:[['list']],use:{baseURL,trace:'retain-on-failure'},projects:[{name:'pilot-smoke',use:{...devices['Desktop Safari']}}]});
