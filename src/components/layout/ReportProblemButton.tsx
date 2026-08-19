'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function ReportProblemButton() {
  const pathname=usePathname(); const [message,setMessage]=useState('');
  async function report(){const description=prompt('Briefly describe the problem (do not include passwords, certificates, activity notes or personal data):')?.slice(0,500)??'';if(!description)return;const diagnostic={route:pathname,appVersion:process.env.NEXT_PUBLIC_BUILD_VERSION??'0.2.0',diagnosticId:crypto.randomUUID(),timestamp:new Date().toISOString(),description};await navigator.clipboard.writeText(JSON.stringify(diagnostic,null,2));setMessage('Safe problem report copied. Send it to pilot support.');}
  return <><button type="button" onClick={()=>void report()}>Report a problem</button>{message&&<span role="status">{message}</span>}</>;
}
