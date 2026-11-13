(async function(token,prompt,kind,image){
  const emit=data=>MuseResult.message(token,JSON.stringify(data));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  window.__keyzoneCancelled=false;
  const disconnected=()=>/muse is disconnected|we disconnected muse to protect your information/i.test(document.body?.innerText||'');
  const composer=()=>[...document.querySelectorAll('textarea,[role=textbox][contenteditable=true]')].find(e=>e.getClientRects().length&&!e.disabled);
  const texts=()=>[...document.querySelectorAll('div[class*=hatch-chat-groupable-bubble]')].filter(e=>/hatch-agent-bubble-bg/.test(e.className||'')).map(e=>(e.innerText||'').trim()).filter(Boolean);
  const media=()=>[...document.querySelectorAll('[data-testid^="hatch-chat-attachment-presentation-"],div[class*=hatch-agent-bubble-bg] img,div[class*=hatch-agent-bubble-bg] video')].flatMap(e=>{
    if(e.closest('form,[class*=chat-user-bubble]'))return[];
    const v=e.tagName==='VIDEO'?e:e.querySelector('video');const img=e.tagName==='IMG'?e:e.querySelector('img');
    const node=kind==='video'?v:img;const src=node&&(node.currentSrc||node.src);
    return src&&!/avatar|emoji/.test(src)?[{src,video:!!v,node}]:[];
  });
  try{
    if(disconnected())throw new Error('Không thể tạo video vì Muse bị mất kết nối.');
    let input=composer();if(!input)throw new Error('Không thể tạo video vì chưa kết nối được ô chat của Muse.');
    if(image){
      const source=atob(image),bytes=new Uint8Array(source.length);for(let i=0;i<source.length;i++)bytes[i]=source.charCodeAt(i);
      const file=new File([bytes],'reference.jpg',{type:'image/jpeg'});const fileInput=document.querySelector('input[type=file]');
      if(!fileInput)throw new Error('Muse chưa cho phép đính kèm ảnh trên trang hiện tại.');
      const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;
      fileInput.dispatchEvent(new Event('change',{bubbles:true}));fileInput.dispatchEvent(new Event('input',{bubbles:true}));
      let attached=false;
      for(let i=0;i<100;i++){if(document.querySelector('button[aria-label*="Remove attachment" i],button[aria-label*="移除附件"]')||composer()?.closest('form')?.querySelector('img')){attached=true;break;}await sleep(250);}
      if(!attached)throw new Error('Muse chưa xác nhận ảnh tham chiếu. Hãy thử lại.');
      input=composer();if(!input)throw new Error('Muse chưa sẵn sàng gửi yêu cầu.');
    }
    const baseline=new Set(media().map(m=>m.src));const baseTexts=texts();
    input.focus();
    if(input.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,prompt);}
    else{input.textContent=prompt;}
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    let sent=false;
    for(let i=0;i<40;i++){
      const button=[...document.querySelectorAll('button,[role=button]')].find(b=>b.getClientRects().length&&!b.disabled&&/发送|send/i.test((b.getAttribute('aria-label')||'')+' '+(b.getAttribute('data-testid')||'')+' '+(b.innerText||'')));
      if(button){button.click();sent=true;break;}await sleep(100);
    }
    if(!sent)throw new Error('Muse chưa sẵn sàng gửi yêu cầu. Hãy kiểm tra lại kết nối.');
    let previous='',stable=0;
    const deadline=Date.now()+(kind==='video'?890000:kind==='image'?350000:290000);
    while(Date.now()<deadline){
      if(window.__keyzoneCancelled)throw new Error('Đã dừng tác vụ.');
      if(disconnected())throw new Error('Không thể tạo video vì Muse bị mất kết nối.');
      const scroll=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+100&&/auto|scroll/.test(getComputedStyle(e).overflowY)).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];if(scroll)scroll.scrollTop=scroll.scrollHeight;
      const replies=texts();const reply=replies[replies.length-1]||'';
      const changed=replies.length>baseTexts.length||reply!==baseTexts[baseTexts.length-1];
      const stop=!!document.querySelector('[data-testid=hatch-composer-stop-button],button[aria-label*=Stop],button[aria-label*=停止]');
      if(kind==='text'&&changed&&reply){
        stable=reply===previous?stable+1:0;previous=reply;
        if(!stop&&stable>=4){emit({type:'text',text:reply});return;}
      }else if(kind!=='text'){
        const found=media().find(m=>!baseline.has(m.src)&&(kind==='video'?m.video:(m.node.naturalWidth||0)>64));
        if(found){
          const response=await fetch(found.src);if(!response.ok)throw new Error('Chưa tải được media Muse trả về.');
          const blob=await response.blob();if(blob.size<100||blob.size>200*1024*1024)throw new Error('File Muse trả về không hợp lệ hoặc quá lớn.');
          if(kind==='video'&&!blob.type.startsWith('video/')){await sleep(700);continue;}
          const bytes=new Uint8Array(await blob.arrayBuffer());emit({type:'start',mime:blob.type});
          const size=192*1024;let index=0;
          for(let offset=0;offset<bytes.length;offset+=size){
            if(window.__keyzoneCancelled)throw new Error('Đã dừng tác vụ.');
            const block=bytes.subarray(offset,offset+size);let binary='';for(let i=0;i<block.length;i++)binary+=String.fromCharCode(block[i]);
            emit({type:'chunk',index:index++,data:btoa(binary)});await sleep(0);
          }
          emit({type:'end',bytes:bytes.length});return;
        }
        stable=reply&&changed&&reply===previous?stable+1:0;previous=reply;
        if(!stop&&stable>=25&&reply)throw new Error('Muse chỉ trả về văn bản, chưa tạo được media. '+reply.slice(0,200));
      }
      await sleep(600);
    }
    throw new Error('Muse chưa hoàn tất trong thời gian chờ. Bạn có thể thử lại.');
  }catch(error){emit({type:'error',message:error.message||'Không kết nối được Muse.'});}
})
