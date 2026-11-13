// Read-only verification, or cleanup restricted to a named probe project created by the UI test.
import assert from "node:assert/strict";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const [mode, id, title] = process.argv.slice(2);
  if (mode === "idle") {
    const result = await pool.query("SELECT count(*)::int AS count FROM pgboss.job WHERE state = 'active' AND name IN ('script-generate','scene-produce','project-render')");
    assert.equal(result.rows[0].count, 0, "Worker has active jobs; defer restart");
    console.log("Worker has no active script/scene/render jobs.");
  } else {
    assert.match(id || "", /^[a-f0-9-]{36}$/);
    assert.match(title || "", /^codex-import-probe-[a-f0-9]+$/);
    const { rows: [project] } = await pool.query("SELECT id,title,status,scene_count,script_source,reference_image_path,reference_image_kind,product_image_paths FROM projects WHERE id=$1 AND title=$2", [id, title]);
    assert.ok(project, "Probe project not found or title mismatch");
    if (mode === "cleanup") {
      await pool.query("DELETE FROM projects WHERE id=$1 AND title=$2 AND script_source='imported-wordless'", [id,title]);
      console.log("Removed only the probe project created by the UI test.");
    } else if (mode === "verify" || mode === "verify-product" || mode === "verify-products") {
      if (mode === "verify-products") {
        const keys = JSON.parse(process.argv[5]);
        assert.equal(keys.length,2);
        assert.deepEqual(project.product_image_paths, keys);
        assert.equal(project.reference_image_path,keys[0]);
        assert.equal(project.reference_image_kind,"product");
        console.log("PASS: full ordered image list persisted with product semantics.");
      }
      if (mode === "verify-product") {
        const imageKey = process.argv[5];
        assert.match(imageKey || "", /^uploads\/images\/[a-f0-9-]{36}\.jpg$/);
        assert.equal(project.reference_image_path,imageKey);
        assert.equal(project.reference_image_kind,"product");
        console.log("PASS: uploaded product reference persisted with product semantics.");
      }
      assert.equal(project.status,"script_ready");
      assert.equal(project.scene_count,10);
      assert.equal(project.script_source,"imported-wordless");
      const { rows } = await pool.query("SELECT narration,visual_prompt,camera FROM scenes WHERE project_id=$1 ORDER BY index",[id]);
      assert.equal(rows.length,10);
      rows.forEach((scene,index)=>{assert.equal(scene.visual_prompt,`Exact imported scene ${index+1}. Keep this prompt!`);assert.equal(scene.narration,"");assert.equal(scene.camera,"");});
      const jobs = await pool.query("SELECT count(*)::int AS count FROM pgboss.job WHERE data->>'projectId'=$1",[id]);
      assert.equal(jobs.rows[0].count,0,"Import must not enqueue script or media generation");
      console.log("PASS: 10 exact scenes stored, ready for review; no script or media jobs enqueued.");
    } else throw new Error("Unknown probe operation");
  }
} finally { await pool.end(); }
