import assert from "node:assert/strict";
import test from "node:test";
import { hasProductReference, withProductIdentity } from "./product-reference";
import { expandStoryboard } from "./storyboard";

test("product and existing place references retain distinct semantics", () => {
  assert.equal(hasProductReference({referenceImagePath:"uploads/images/test.jpg",referenceImageKind:"product"}),true);
  assert.equal(hasProductReference({referenceImagePath:"uploads/images/test.jpg",referenceImageKind:"place"}),false);
  assert.equal(hasProductReference({referenceImagePath:null,referenceImageKind:"product"}),false);
  assert.equal(withProductIdentity("Exact supplied prompt",false),"Exact supplied prompt");
  const image = withProductIdentity("A studio close-up",true);
  const video = withProductIdentity("Slow orbit",true,"video");
  assert.ok(image.startsWith("A studio close-up"));
  assert.ok(image.includes("not a character sheet"));
  assert.ok(video.includes("first frame throughout"));
  assert.ok(video.includes("printed label and existing logo"));
});

test("every storyboard planning and detail request carries product constraints", async () => {
  let turns = 0;
  const result = await expandStoryboard("Show the product on a desk",null,"9:16",async prompt => {
    assert.ok(prompt.includes("user attached a product photograph"));
    assert.ok(prompt.includes("unverified claims"));
    return ++turns === 1 ? JSON.stringify({title:"Product",beats:["Hero shot"]})
      : JSON.stringify({scenes:[{visualPrompt:"The attached product on a desk",camera:"dolly",narration:""}]});
  },true);
  assert.equal(result.scenes.length,1);
});
