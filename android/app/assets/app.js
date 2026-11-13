'use strict';
(() => {
const root=document.querySelector('#app');
const preview=typeof KeyZoneNative==='undefined';
let data={projects:[],niches:[],characters:[],accounts:[],settings:{},busy:false,job:{}},screen={type:'projects'},history=[],formFiles={},noticeTimer,requestBusy=false;
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=file=>'https://keyzone.local/files/'+encodeURIComponent(file);
const find=(kind,id)=>data[kind].find(item=>item.id===id);
const disabled=()=>data.busy||requestBusy?' disabled':'';
const statusLabel={draft:'Bản nháp',scripting:'Đang viết kịch bản',script_ready:'Kịch bản sẵn sàng',producing:'Đang tạo cảnh',rendering:'Đang xuất video',done:'Hoàn tất',failed:'Cần kiểm tra',pending:'Chưa tạo',drawing:'Đang tạo ảnh',animating:'Đang tạo video',generating:'Đang tạo ảnh',ready:'Sẵn sàng'};
function button(text,action,attrs='',kind=''){return `<button class="${kind}" data-action="${action}" ${attrs}${disabled()}>${text}</button>`;}
function field(label,name,value='',type='text',help=''){return `<label class="field"><span>${label}</span>${type==='textarea'?`<textarea name="${name}">${e(value)}</textarea>`:`<input type="${type}" name="${name}" value="${e(value)}">`}${help?`<small>${help}</small>`:''}</label>`;}
function select(label,name,items,value){return `<label class="field"><span>${label}</span><select name="${name}">${items.map(([id,title])=>`<option value="${e(id)}"${String(id)===String(value)?' selected':''}>${e(title)}</option>`).join('')}</select></label>`;}
function top(title,subtitle='',action=''){return `<div class="page-top"><div><p class="eyebrow">KEYZONE VIDEO STUDIO</p><h1>${e(title)}</h1>${subtitle?`<p class="subtle">${e(subtitle)}</p>`:''}</div>${action}</div>`;}
function back(){return '<button class="back" data-action="back">← Quay lại</button>';}
function empty(title,detail,action=''){return `<div class="empty"><span class="empty-icon">◇</span><h3>${title}</h3>${detail}${action}</div>`;}
function notify(text,error=false){clearTimeout(noticeTimer);const box=document.querySelector('#notice');box.innerHTML=`<span>${e(text)}</span><button data-action="dismiss" aria-label="Đóng thông báo">×</button>`;box.style.borderColor=error?'#8c4159':'';box.hidden=false;noticeTimer=setTimeout(()=>box.hidden=true,error?8000:4000);}
async function native(action,payload={}){
  if(preview){if(action==='snapshot')return data;throw Error('Chức năng này chỉ hoạt động trong ứng dụng Android.');}
  return new Promise((resolve,reject)=>setTimeout(()=>{try{const result=JSON.parse(KeyZoneNative.request(JSON.stringify({action,data:payload})));if(!result.ok){if(result.code==='LICENSE_REQUIRED'){data={license:{valid:false,error:result.error}};render();}throw Error(result.error||'Thao tác chưa thành công.');}resolve(result.data);}catch(error){reject(error);}},20));
}
function go(type,id){history.push(screen);screen={type,id};formFiles={};render();window.scrollTo(0,0);}
function goBack(){screen=history.pop()||{type:'projects'};formFiles={};render();window.scrollTo(0,0);}
window.keyzoneBack=()=>{if(history.length||screen.type!=='projects')goBack();else native('app.background').catch(()=>{});};
async function refresh(force=false){
  try{const wasBusy=data.busy,wasValid=data.license?.valid;data=await native('snapshot');if(force||wasValid!==data.license?.valid||!document.activeElement?.matches('input,textarea,select')&&!screen.type.endsWith('-form')&&!screen.type.endsWith('-edit'))render();if(wasBusy&&!data.busy&&data.job?.label)notify(data.job.label,data.job.label!=='Đã hoàn tất');}
  catch(error){notify(error.message,true);}
}
function activationView(){
  const message=data.license?.error||'Nhập key do quản trị viên cấp để sử dụng KeyZone.';
  return `<section class="activation"><div class="card"><p class="eyebrow">BẢN QUYỀN KEYZONE</p><h1>Kích hoạt studio</h1><p>Nhập key để bắt đầu tạo video trên điện thoại.</p><p class="hint" role="status">${e(message)}</p><form id="license-form"><label class="field"><span>Key kích hoạt</span><input name="licenseKey" type="password" minlength="16" maxlength="80" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Nhập key của bạn"></label><button type="submit" class="primary big-cta">Kích hoạt KeyZone</button></form><button class="big-cta" data-action="license-retry">Kiểm tra lại kết nối / thời hạn</button><p class="subtle">Cần Internet để kiểm tra key. Dự án và video đã lưu vẫn được giữ trên điện thoại.</p></div></section>`;
}
function licenseCard(){
  const license=data.license;if(!license?.valid)return '';
  const date=new Date(license.expiresAt),expiry=Number.isNaN(date.getTime())?'Chưa xác định':date.toLocaleString('vi-VN');
  return `<div class="card license-card"><h2>Bản quyền đang hoạt động</h2><p>Khách hàng: ${e(license.customer)}</p><p>Hết hạn: ${e(expiry)}</p><p class="subtle">Thời gian theo múi giờ trên điện thoại. Key được kiểm tra trực tuyến.</p><button data-action="license-deactivate">Gỡ kích hoạt trên điện thoại này</button></div>`;
}
function render(){
  const locked=!preview&&!data.license?.valid;
  document.querySelector('nav').hidden=locked;
  document.querySelector('[data-action="settings"]').hidden=locked;
  if(locked){root.innerHTML=activationView();return;}
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',screen.type.startsWith(b.dataset.tab.slice(0,-1))||screen.type===b.dataset.tab));
  let html='';
  if(preview)html+='<p class="hint">Bản xem trước giao diện Android. Xử lý video và đăng nhập Muse chỉ hoạt động trong APK.</p>';
  if(data.busy)html+=`<div class="job"><div class="job-head"><span class="spinner"></span><p>${e(data.job.label)}</p><button data-action="cancel-job">Dừng</button></div><div class="job-bar"></div></div>`;
  if(screen.type==='projects'){
    html+=top('Dự án của bạn','Lưu và xử lý ngay trên điện thoại.',button('+ Tạo mới','project-new','','primary'));
    html+=data.projects.length?`<div class="grid">${data.projects.map(p=>`<article class="card clickable" data-action="project-open" data-id="${p.id}">${p.thumbnailFile?`<img class="cover" src="${image(p.thumbnailFile)}" alt="">`:''}<div class="card-head"><h3>${e(p.title)}</h3><span class="status ${p.status==='done'?'green':p.status==='failed'?'red':''}">${statusLabel[p.status]||e(p.status)}</span></div><p>${e(p.topic||find('niches',p.nicheId)?.name||'')}</p><div class="tags"><span class="tag">${e(p.aspectRatio)}</span><span class="tag">${p.scenes?.length||0} cảnh</span></div></article>`).join('')}</div>`:empty('Câu chuyện tiếp theo bắt đầu ở đây','Tạo dự án, chuẩn bị kịch bản và kết nối Muse để bắt đầu.',button('Tạo dự án đầu tiên','project-new','','primary'));
  }else if(screen.type==='project-form')html+=projectForm();
  else if(screen.type==='project'){const p=find('projects',screen.id);html+=p?projectView(p):empty('Dự án không còn tồn tại','Hãy quay lại danh sách.');}
  else if(screen.type==='project-edit'){const p=find('projects',screen.id);html+=p?sceneEditor(p):'';}
  else if(screen.type==='niches'){
    html+=top('Ngách nội dung','Hướng dẫn, phong cách và cấu trúc video.',button('+ Thêm','niche-new','','primary'));
    html+=`<div class="grid">${data.niches.map(n=>`<article class="card clickable" data-action="niche-open" data-id="${n.id}"><span class="niche-icon">${e(n.icon||'✦')}</span><h3>${e(n.name)}</h3><p>${e(n.description||n.tone||'Ngách tùy chỉnh')}</p><div class="tags"><span class="tag">${n.sceneCount||6} cảnh</span><span class="tag">${e({story:'Có lời dẫn',wordless:'Không lời',ambient:'Video nhạc nền'}[n.format]||'Có lời dẫn')}</span></div></article>`).join('')}</div>`;
  }else if(screen.type==='niche-form')html+=nicheForm(find('niches',screen.id)||{});
  else if(screen.type==='characters'){
    html+=top('Dàn nhân vật','Ảnh tham chiếu cho các cảnh của bạn.',button('+ Thêm','character-new','','primary'));
    html+=data.characters.length?`<div class="grid">${data.characters.map(c=>`<article class="card">${c.referenceFile?`<img class="cover character-cover" src="${image(c.referenceFile)}" alt="${e(c.name)}">`:`<div class="character-placeholder">${e((c.name||'?')[0])}</div>`}<h3>${e(c.name)}</h3><p>${e(c.description)}</p>${c.error?`<p class="status red">${e(c.error)}</p>`:''}<div class="actions">${button('Chỉnh sửa','character-open',`data-id="${c.id}"`)}${button(c.referenceFile?'Tạo lại ảnh':'Tạo ảnh','job',`data-kind="character" data-id="${c.id}"`,'primary')}</div></article>`).join('')}</div>`:empty('Tạo nhân vật của bạn','Mô tả nhân vật hoặc tải ảnh tham chiếu để giữ hình ảnh xuyên suốt.',button('Thêm nhân vật','character-new','','primary'));
  }else if(screen.type==='character-form')html+=characterForm(find('characters',screen.id)||{});
  else if(screen.type==='accounts')html+=accountsView();
  else if(screen.type==='settings')html+=settingsView();
  root.innerHTML=html;
}
function upload(label,tag,mime='image/*',file=''){return `<div class="field"><span>${label}</span><div class="upload">${button(file?'Thay file':'Chọn file','pick',`data-tag="${tag}" data-mime="${mime}"`)}<span id="upload-${tag}"${file?' class="file-label"':''}>${file?'Đã chọn file':'Chưa chọn'}</span></div></div>`;}
function projectForm(){
  if(!data.niches.length)return back()+empty('Chưa có ngách','Hãy thêm ngách trước khi tạo dự án.');
  return back()+top('Một video mới')+`<form id="project-form"><div class="card">${field('Tên video','title')}${field('Chủ đề / ý tưởng','topic','','textarea')}${select('Ngách nội dung','nicheId',data.niches.map(n=>[n.id,n.name]),data.niches[0]?.id)}${select('Chuẩn bị kịch bản','mode',[['generated','Muse viết kịch bản'],['imported','Nhập prompt / kịch bản có sẵn']],'generated')}<div id="import-field" hidden>${field('Kịch bản / prompt có sẵn','imported','','textarea','Dán JSON có scenes hoặc mỗi đoạn prompt cách nhau một dòng trống.')}</div><div class="field-row">${field('Số cảnh','sceneCount',6,'number')}${select('Tỷ lệ khung hình','aspectRatio',[['9:16','Dọc 9:16'],['16:9','Ngang 16:9']],'9:16')}</div>${select('Chất lượng xuất','quality',[[1080,'1080p'],[720,'720p · nhẹ hơn']],1080)}${upload('Ảnh tham chiếu / sản phẩm','referenceFile')}${upload('Nhạc nền (tùy chọn)','audioFile','audio/*')}${data.characters.length?`<div class="field"><span>Nhân vật trong dự án</span><div class="checks">${data.characters.filter(c=>c.referenceFile).map(c=>`<label class="check"><input type="checkbox" name="characterIds" value="${c.id}"><img src="${image(c.referenceFile)}" alt="">${e(c.name)}</label>`).join('')}</div></div>`:''}</div><div class="sticky-actions"><button class="primary" type="submit">Tạo dự án</button></div></form>`;
}
function projectView(p){
  const scenes=p.scenes||[];const clips=scenes.length&&scenes.every(s=>s.clipFile);
  return back()+top(p.title,p.topic||'')+`<div class="progress-steps"><span class="${scenes.length?'complete':'active'}">01 · Kịch bản</span><span class="${clips?'complete':scenes.length?'active':''}">02 · Tạo cảnh</span><span class="${p.videoFile?'complete':clips?'active':''}">03 · Xuất video</span></div>${p.error?`<div class="error" role="alert">${e(p.error)}</div>`:''}<div class="actions">${!p.scriptSource?.startsWith('imported-')?button(scenes.length?'Viết lại kịch bản':'Viết kịch bản','job',`data-kind="script" data-id="${p.id}"`):''}${scenes.length?button('Chỉnh kịch bản','edit-scenes',`data-id="${p.id}"`):''}${scenes.length?button(p.videoFile?'Tạo / dựng lại':'Tạo video','job',`data-kind="produce" data-id="${p.id}"`,'primary'):''}${clips?button('Chỉ dựng lại video','job',`data-kind="render" data-id="${p.id}"`):''}</div>${p.videoFile?`<section class="section"><h2>Video của bạn</h2><video src="${image(p.videoFile)}" controls playsinline preload="metadata"></video><div class="actions">${button('Lưu video','export',`data-file="${p.videoFile}" data-title="${e(p.title)}"`,'primary')}${button('Chia sẻ','share',`data-file="${p.videoFile}" data-title="${e(p.title)}"`)}</div><p class="subtle">Video được lưu vào thư viện Movies / KeyZone.</p></section>`:''}${scenes.length?`<section class="section"><div class="row-title"><h2>Kịch bản · ${scenes.length} cảnh</h2><span class="subtle">${e(p.aspectRatio)}</span></div>${scenes.map((s,i)=>`<article class="card scene"><p class="scene-number">CẢNH ${String(i+1).padStart(2,'0')}</p><span class="status ${s.status==='done'?'green':s.status==='failed'?'red':''}">${statusLabel[s.status]||'Chưa tạo'}</span>${s.imageFile?`<img src="${image(s.imageFile)}" alt="Ảnh cảnh ${i+1}">`:''}${s.clipFile?`<details><summary>Xem clip cảnh này</summary><video src="${image(s.clipFile)}" controls preload="none" playsinline></video></details>`:''}${s.narration?`<p>${e(s.narration)}</p>`:''}<details><summary>Prompt hình ảnh / chuyển động</summary><p class="prompt">${e(s.visualPrompt)}</p>${s.camera?`<p class="prompt">Camera: ${e(s.camera)}</p>`:''}</details>${s.error?`<div class="error">${e(s.error)}</div>`:''}<div class="actions">${button('Tạo lại cảnh','reset-scene',`data-id="${p.id}" data-index="${i}"`)}</div></article>`).join('')}</section>`:''}${p.videoFile||scenes.some(s=>s.imageFile)?`<section class="section"><h2>Hoàn thiện & chia sẻ</h2><div class="actions">${button('Tạo thumbnail','job',`data-id="${p.id}" data-kind="thumbnail"`)}${button('Viết mô tả','job',`data-id="${p.id}" data-kind="posts"`)}${p.videoFile?button('Tạo Shorts','job',`data-id="${p.id}" data-kind="shorts"`):''}</div>${p.thumbnailFile?`<img class="cover" style="height:auto;margin-top:18px" src="${image(p.thumbnailFile)}" alt="Thumbnail"><div class="actions">${button('Lưu thumbnail','export',`data-file="${p.thumbnailFile}" data-title="${e(p.title)}"`)}</div>`:''}${p.posts?`<div class="card section"><h3>Nội dung đăng video</h3><div class="caption">${e(p.posts)}</div><div class="actions">${button('Sao chép nội dung','copy-posts',`data-id="${p.id}"`)}</div></div>`:''}${(p.shorts||[]).map(s=>`<div class="card short"><h3>${e(s.title)}</h3><video src="${image(s.file)}" controls playsinline preload="none"></video><div class="actions">${button('Lưu Short','export',`data-file="${s.file}" data-title="${e(s.title)}"`)}${button('Chia sẻ','share',`data-file="${s.file}" data-title="${e(s.title)}"`)}</div></div>`).join('')}</section>`:''}<div class="muted-line"></div>${button('Xóa dự án','delete',`data-kind="projects" data-id="${p.id}"`,'danger')}`;
}
function sceneEditor(p){return back()+top('Chỉnh kịch bản')+`<form id="scene-form" data-id="${p.id}">${field('Tên video','title',p.title)}${p.scenes.map((s,i)=>`<div class="card scene" data-scene="${i}"><p class="scene-number">CẢNH ${i+1}</p>${field('Lời dẫn / lời đọc','narration-'+i,s.narration||'','textarea')}${field('Prompt hình ảnh & chuyển động','visualPrompt-'+i,s.visualPrompt,'textarea')}${field('Camera','camera-'+i,s.camera||'')}<label class="check"><input type="checkbox" name="continuesPrevious-${i}"${s.continuesPrevious?' checked':''}${i===0?' disabled':''}>Nối tiếp cảnh trước</label></div>`).join('')}<div class="sticky-actions"><button type="submit" class="primary">Lưu kịch bản</button></div></form>`;}
function nicheForm(n){return back()+top(n.id?'Chỉnh ngách':'Thêm ngách')+`<form id="niche-form" data-id="${n.id||''}"><div class="card">${field('Tên ngách','name',n.name||'')}${field('Biểu tượng','icon',n.icon||'✦')}${field('Mô tả ngắn','description',n.description||'','textarea')}${select('Kiểu video','format',[['story','Video có lời dẫn'],['wordless','Video không lời'],['ambient','Video lặp theo nhạc']],n.format||'story')}${field('Hướng dẫn viết kịch bản','scriptInstructions',n.scriptInstructions||'','textarea')}${field('Giọng điệu','tone',n.tone||'')}${field('Phong cách hình ảnh','visualStyle',n.visualStyle||'','textarea')}<div class="field-row">${field('Số cảnh','sceneCount',n.sceneCount||6,'number')}${field('Giây mỗi cảnh','sceneSeconds',n.sceneSeconds||8,'number')}</div>${field('Ngôn ngữ','language',n.language||'vi')}${field('ElevenLabs Voice ID (tùy chọn)','narratorVoiceId',n.narratorVoiceId||'','text','Để trống nếu không dùng giọng đọc riêng.')}</div><div class="sticky-actions"><button type="submit" class="primary">Lưu ngách</button>${n.id?button('Xóa','delete',`data-kind="niches" data-id="${n.id}"`,'danger'):''}</div></form>`;}
function characterForm(c){return back()+top(c.id?'Chỉnh nhân vật':'Nhân vật mới')+`<form id="character-form" data-id="${c.id||''}"><div class="card">${field('Tên nhân vật','name',c.name||'')}${field('Mô tả nhận diện','description',c.description||'','textarea','Ngoại hình, trang phục, màu sắc và những chi tiết cần giữ xuyên suốt.')}${upload('Ảnh tham chiếu (tùy chọn)','characterFile','image/*',c.referenceFile||'')}${c.referenceFile?`<img class="cover character-cover" src="${image(c.referenceFile)}" alt="">`:''}</div><div class="sticky-actions"><button type="submit" class="primary">Lưu nhân vật</button>${c.id?button('Xóa','delete',`data-kind="characters" data-id="${c.id}"`,'danger'):''}</div></form>`;}
function accountsView(){return top('Tài khoản Muse','Đăng nhập Muse để tạo video.')+`<div class="card"><h3>Kết nối tài khoản</h3><p>Mỗi tài khoản và phiên đăng nhập được lưu riêng trên điện thoại.</p>${button('+ Kết nối Muse','muse-login','','primary big-cta')}</div><section class="section"><h2>Tài khoản đã kết nối · ${data.accounts.length}</h2><div class="grid">${data.accounts.map(a=>{const ready=a.status==='connected'&&Date.now()-a.checkedAt<300000;return `<article class="card"><h3>${e(a.label)}</h3><span class="status ${a.status==='disconnected'?'red':ready?'green':'warning'}">${a.status==='disconnected'?'Muse đã ngắt kết nối':ready?'Workspace sẵn sàng · vừa kiểm tra':'Cần kiểm tra workspace'}</span>${a.status==='disconnected'?'<p>Mở Muse và gửi ticket để kết nối lại, hoặc thay tài khoản.</p>':''}${a.checkedAt?`<p class="subtle">Kiểm tra: ${e(new Date(a.checkedAt).toLocaleString('vi-VN'))}</p>`:''}<div class="actions three">${button('Kiểm tra','muse-check',`data-id="${a.id}"`)}${button('Thay','muse-login',`data-id="${a.id}"`)}${button('×','delete',`data-kind="accounts" data-id="${a.id}"`,'icon danger')}</div></article>`;}).join('')}</div>${!data.accounts.length?empty('Chưa có tài khoản','Kết nối tài khoản Muse của bạn để viết kịch bản và tạo cảnh.'):''}</section>`;}
function settingsView(){const s=data.settings;return back()+top('Cài đặt')+licenseCard()+`<div class="card"><h3>Ứng dụng Android độc lập</h3><p>Dự án và bộ xuất video nằm trên điện thoại. Muse vẫn cần Internet và tài khoản hoạt động.</p><div class="actions">${button('Kiểm tra bộ xuất video','job','data-kind="selftest" data-id="diagnostic"')}</div></div><form id="settings-form" class="section"><div class="card"><h2>Dịch vụ tùy chọn</h2><p>Chỉ dùng khóa API của bạn. Các dịch vụ có thể tính phí theo tài khoản của bạn.</p>${field('ElevenLabs API key','ELEVENLABS_API_KEY','','password',s.ELEVENLABS_API_KEY?'Đã có khóa được lưu. Để trống để giữ nguyên.':'Chưa cấu hình. Không cần nếu bạn không dùng giọng đọc ElevenLabs.')}${field('ElevenLabs model','ELEVENLABS_MODEL',s.ELEVENLABS_MODEL||'eleven_multilingual_v2')}${field('AI Gateway base URL (tùy chọn)','CF_AIG_BASE_URL',s.CF_AIG_BASE_URL||'','url','URL tương thích OpenAI, kết thúc bằng /compat; để trống để Muse viết kịch bản.')}${field('AI Gateway token','CF_AIG_TOKEN','','password',s.CF_AIG_TOKEN?'Đã có token. Để trống để giữ nguyên.':'')}${field('Model viết kịch bản','SCRIPT_MODEL',s.SCRIPT_MODEL||'deepseek/deepseek-chat')}</div><div class="sticky-actions"><button type="submit" class="primary">Lưu cài đặt</button></div></form><div class="section"><p class="subtle">KeyZone Video Studio · Android 0.7.5-beta.1</p><p class="subtle">Bộ xử lý media sử dụng FFmpegKit (LGPLv3). <a class="about" href="https://github.com/ffmpegkit-maintained/ffmpeg">Thư viện & mã nguồn ↗</a></p></div>`;}
document.addEventListener('change',event=>{if(event.target.name==='mode'){const field=document.querySelector('#import-field');if(field)field.hidden=event.target.value!=='imported';}});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();if(target.disabled)return;
  const action=target.dataset.action,id=target.dataset.id;
  try{
    if(action==='license-retry'){requestBusy=true;target.disabled=true;target.textContent='Đang kiểm tra…';try{await native('license.status',{force:true});requestBusy=false;await refresh(true);}finally{requestBusy=false;}return;}
    if(action==='license-deactivate'){if(!confirm('Gỡ kích hoạt và giải phóng thiết bị này? Dự án và video vẫn được giữ lại.'))return;requestBusy=true;try{await native('license.deactivate');requestBusy=false;history=[];screen={type:'projects'};await refresh(true);}finally{requestBusy=false;}return;}
    if(action==='dismiss'){document.querySelector('#notice').hidden=true;return;}
    if(action==='home'){history=[];screen={type:'projects'};render();return;}
    if(action==='tab'){history=[];screen={type:target.dataset.tab};formFiles={};await refresh(true);return;}
    if(action==='back'){goBack();return;}
    if(action==='settings'){go('settings');return;}
    if(action==='project-new'){go('project-form');return;}
    if(action==='project-open'){go('project',id);return;}
    if(action==='edit-scenes'){go('project-edit',id);return;}
    if(action==='niche-new'){go('niche-form');return;}
    if(action==='niche-open'){go('niche-form',id);return;}
    if(action==='character-new'){go('character-form');return;}
    if(action==='character-open'){go('character-form',id);return;}
    if(action==='muse-login'){await native('muse.login',id?{id}:{});return;}
    if(action==='muse-check'){requestBusy=true;target.textContent='Đang kiểm tra…';target.disabled=true;try{await native('muse.check',{id});notify('Đã kiểm tra workspace.');}finally{requestBusy=false;await refresh(true);}return;}
    if(action==='job'){
      if(target.dataset.kind==='script'&&find('projects',id)?.scenes?.length&&!confirm('Viết lại sẽ thay thế kịch bản và cảnh hiện tại. Tiếp tục?'))return;
      await native('job.start',{kind:target.dataset.kind,id});await refresh(true);return;
    }
    if(action==='cancel-job'){await native('job.cancel');notify('Đang dừng tác vụ…');return;}
    if(action==='pick'){await native('file.pick',{tag:target.dataset.tag,mime:target.dataset.mime});return;}
    if(action==='export'||action==='share'){await native('export',{file:target.dataset.file,title:target.dataset.title,share:action==='share'});if(action==='export')notify('Đã lưu vào thư viện KeyZone.');return;}
    if(action==='delete'){
      if(!confirm('Xóa mục này?'))return;await native('delete',{kind:target.dataset.kind,id});notify(target.dataset.kind==='accounts'?'Đã gỡ kết nối.':'Đã xóa.');
      if(screen.type.includes('form')||screen.type==='project'){screen={type:target.dataset.kind};history=[];}await refresh(true);return;
    }
    if(action==='copy-posts'){await native('clipboard',{text:find('projects',id).posts});notify('Đã sao chép nội dung.');return;}
    if(action==='reset-scene'){
      if(!confirm('Tạo lại ảnh và video của cảnh này?'))return;await native('scene.reset',{id,index:Number(target.dataset.index)});await native('job.start',{id,kind:'produce'});await refresh(true);return;
    }
  }catch(error){notify(error.message,true);}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;const values=new FormData(form);const field=name=>String(values.get(name)||'').trim();const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;
  try{
    if(form.id==='license-form'){
      requestBusy=true;if(submit)submit.textContent='Đang kích hoạt…';
      try{await native('license.activate',{key:field('licenseKey')});requestBusy=false;screen={type:'projects'};history=[];await refresh(true);notify('Đã kích hoạt KeyZone.');}
      finally{requestBusy=false;if(submit)submit.textContent='Kích hoạt KeyZone';}return;
    }
    if(form.id==='project-form'){
      const payload={title:field('title')||field('topic').slice(0,80),topic:field('topic'),nicheId:field('nicheId'),aspectRatio:field('aspectRatio'),quality:Number(field('quality')),sceneCount:Number(field('sceneCount')),characterIds:values.getAll('characterIds'),...formFiles};
      if(field('mode')==='imported'){
        const raw=field('imported');if(!raw)throw Error('Hãy nhập kịch bản hoặc prompt.');let scenes;
        if(raw.startsWith('{')||raw.startsWith('[')){const parsed=JSON.parse(raw);scenes=Array.isArray(parsed)?parsed:parsed.scenes;if(!Array.isArray(scenes))throw Error('JSON cần có mảng scenes.');}
        else scenes=raw.split(/\n\s*\n/).map(text=>({narration:'',visualPrompt:text.trim(),camera:''})).filter(s=>s.visualPrompt);
        payload.scenes=scenes.map(s=>({narration:s.narration||'',visualPrompt:s.visualPrompt||s.prompt||'',camera:s.camera||'',continuesPrevious:!!s.continuesPrevious,status:'pending'}));payload.scriptSource=scenes.every(s=>!s.narration)?'imported-wordless':'imported-story';
      }
      const project=await native('project.save',payload);screen={type:'project',id:project.id};history=[{type:'projects'}];formFiles={};await refresh(true);
      if(field('mode')!=='imported'){await native('job.start',{kind:'script',id:project.id});await refresh(true);}return;
    }
    if(form.id==='scene-form'){
      const p=find('projects',form.dataset.id),scenes=p.scenes.map((s,i)=>({...s,narration:field('narration-'+i),visualPrompt:field('visualPrompt-'+i),camera:field('camera-'+i),continuesPrevious:i>0&&values.has('continuesPrevious-'+i)}));
      await native('project.save',{id:p.id,title:field('title'),scenes});goBack();await refresh(true);notify('Đã lưu kịch bản.');return;
    }
    if(form.id==='niche-form'){
      const old=find('niches',form.dataset.id)||{};const payload={...old,name:field('name'),icon:field('icon'),description:field('description'),format:field('format'),scriptInstructions:field('scriptInstructions'),tone:field('tone'),visualStyle:field('visualStyle'),sceneCount:Number(field('sceneCount')),sceneSeconds:Number(field('sceneSeconds')),language:field('language'),narratorVoiceId:field('narratorVoiceId')};
      if(!payload.id)delete payload.id;await native('niche.save',payload);goBack();await refresh(true);notify('Đã lưu ngách.');return;
    }
    if(form.id==='character-form'){
      const old=find('characters',form.dataset.id)||{};const payload={...old,name:field('name'),description:field('description')};if(formFiles.characterFile)payload.referenceFile=formFiles.characterFile;
      await native('character.save',payload);goBack();await refresh(true);notify('Đã lưu nhân vật.');return;
    }
    if(form.id==='settings-form'){
      const payload={};for(const [key,value]of values){if(value||!['ELEVENLABS_API_KEY','CF_AIG_TOKEN'].includes(key))payload[key]=String(value).trim();}
      await native('settings.save',payload);notify('Đã lưu cài đặt.');await refresh();return;
    }
  }catch(error){notify(error.message,true);}finally{if(submit)submit.disabled=false;}
});
window.addEventListener('keyzone-file',event=>{formFiles[event.detail.tag]=event.detail.file;const label=document.querySelector('#upload-'+event.detail.tag);if(label){label.textContent='Đã chọn file';label.className='file-label';}});
window.addEventListener('keyzone-changed',()=>{if(!requestBusy)refresh();});
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&!preview&&!requestBusy){try{await native('license.status',{force:true});requestBusy=false;await refresh(true);}catch(error){notify(error.message,true);}}});
async function boot(){
  if(preview){try{const response=await fetch('./default-niches.json');data.niches=(await response.json()).map((n,i)=>({...n,id:'preview-'+i}));}catch{}render();}
  else await refresh(true);
  setInterval(()=>{if(!document.hidden&&!requestBusy)refresh();},2000);
}
boot();
})();
