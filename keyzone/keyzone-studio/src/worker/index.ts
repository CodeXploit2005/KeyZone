import { requireLicense } from "@/lib/license";
import { env } from "@/lib/env";
import {
  generateCharacterReference,
  generatePosts,
  generateScript,
  planShorts,
  generateThumbnail,
  produceScene,
  renderProject,
  renderShortClip,
} from "@/lib/pipeline/jobs";
import { postReel } from "@/lib/pipeline/reels";
import {
  QUEUES,
  getBoss,
  type CharacterReferenceJob,
  type ReelPostJob,
  type ProjectPostsJob,
  type ProjectThumbnailJob,
  type ProjectRenderJob,
  type ProjectShortsJob,
  type ShortRenderJob,
  type SceneProduceJob,
  type ScriptGenerateJob,
} from "@/lib/queue";

async function main() {
  const boss = await getBoss();
  const museConcurrency = env().MUSE_CONCURRENCY;

  await boss.work<ScriptGenerateJob>(QUEUES.scriptGenerate, async ([job]) => {
    await requireLicense();
    console.log(`[script] project ${job.data.projectId}`);
    await generateScript(job.data.projectId);
  });

  await boss.work<CharacterReferenceJob>(QUEUES.characterReference, async ([job]) => {
    await requireLicense();
    console.log(`[character] ${job.data.characterId}`);
    await generateCharacterReference(job.data.characterId);
  });

  await boss.work<SceneProduceJob>(
    QUEUES.sceneProduce,
    { localConcurrency: museConcurrency },
    async ([job]) => {
    await requireLicense();
      console.log(`[scene] ${job.data.sceneId}`);
      await produceScene(job.data.sceneId);
    },
  );

  await boss.work<ProjectRenderJob>(QUEUES.projectRender, async ([job]) => {
    await requireLicense();
    console.log(`[render] project ${job.data.projectId}`);
    await renderProject(job.data.projectId);
  });

  await boss.work<ProjectPostsJob>(QUEUES.projectPosts, async ([job]) => {
    await requireLicense();
    console.log(`[posts] project ${job.data.projectId}`);
    await generatePosts(job.data.projectId);
  });

  await boss.work<ProjectThumbnailJob>(QUEUES.projectThumbnail, async ([job]) => {
    await requireLicense();
    console.log(`[thumbnail] project ${job.data.projectId}`);
    await generateThumbnail(job.data.projectId);
  });

  await boss.work<ProjectShortsJob>(QUEUES.projectShorts, async ([job]) => {
    await requireLicense();
    console.log(`[shorts] project ${job.data.projectId}`);
    await planShorts(job.data.projectId);
  });

  await boss.work<ShortRenderJob>(QUEUES.shortRender, async ([job]) => {
    await requireLicense();
    console.log(`[short] ${job.data.shortId}`);
    await renderShortClip(job.data.shortId);
  });

  await boss.work<ReelPostJob>(QUEUES.reelPost, async ([job]) => {
    await requireLicense();
    console.log(`[reel] ${job.data.platform} ${job.data.kind} ${job.data.id}`);
    await postReel(job.data);
  });

  console.log(`Worker ready (Muse concurrency ${museConcurrency})`);

  const shutdown = async () => {
    console.log("Stopping worker…");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
