import assert from "node:assert/strict";
import { Muse2ApiProvider } from "../src/lib/providers/muse2api";
import { withRetry } from "../src/lib/retry";

async function main() {
  Object.assign(process.env,{DATABASE_URL:"postgres://fixture",MUSE2API_KEY:"fixture",MUSE2API_BASE_URL:"http://localhost:1"});
  const original=globalThis.fetch;
  try {
    for (const fail of ["network","body","http","protocol"]) {
      let sent=0;
      globalThis.fetch=async()=>{
        sent++;
        if(fail==="network")throw new TypeError("offline");
        if(fail==="body"){const response=new Response("");response.text=async()=>{throw new DOMException("timeout","TimeoutError");};return response;}
        return new Response(fail==="http"?JSON.stringify({error:{message:"Chromium failed"}}):"not-json",{status:fail==="http"?502:200});
      };
      await assert.rejects(withRetry("script",()=>new Muse2ApiProvider().chat("fixture")),/Muse|workspace/);
      assert.equal(sent,1,`${fail} must not duplicate a prompt`);
    }
    let outputAttempts=0;
    assert.equal(await withRetry("model-output",async()=>{if(++outputAttempts===1)throw Error("Malformed model output");return "fixed";}),"fixed");
    console.log("PASS failed/uncertain Muse calls are not resent; malformed model output still retries");
  } finally { globalThis.fetch=original; }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
