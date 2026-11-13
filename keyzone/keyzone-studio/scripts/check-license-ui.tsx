import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { LicenseGate } from "../src/components/license-gate";

const verified=renderToStaticMarkup(<LicenseGate initial={{valid:true,expiresAt:"2099-01-01T00:00:00Z"}}><div>WORKSPACE</div></LicenseGate>);
assert.match(verified,/WORKSPACE/);
assert.doesNotMatch(verified,/Kích hoạt quyền sử dụng|license-key|Đang kiểm tra key/);
const checking=renderToStaticMarkup(<LicenseGate><div>PRIVATE</div></LicenseGate>);
assert.match(checking,/Đang mở studio/);assert.doesNotMatch(checking,/PRIVATE|license-key/);
const invalid=renderToStaticMarkup(<LicenseGate initial={{valid:false,error:"Key đang được sử dụng trên thiết bị khác."}}><div>PRIVATE</div></LicenseGate>);
assert.match(invalid,/Key đang được sử dụng/);assert.match(invalid,/license-key/);assert.doesNotMatch(invalid,/PRIVATE/);
console.log("PASS verified reload renders workspace without activation flash; unknown and rejected sessions stay blocked");
