/* FORGE 1.3.0 — Free browser-local open-source vision-language model. No API keys or uploaded photos. */
let processorPromise, modelPromise;
const MODEL='HuggingFaceTB/SmolVLM-256M-Instruct';
const prompt=`Observe this single adult's physique photo for OPTIONAL gym progress discussion. Only describe clearly visible appearance. Lighting, pose and genetics make comparisons uncertain. Never assess health, attractiveness, fitness, body-fat percentage, body mass or muscle weight. Return EXACTLY these four lines, choosing ONE word from the options in each line. Prominent means visibly accentuated relative to the rest of the person's build, moderate means not especially prominent, unclear means not sufficiently visible.
SHOULDERS: prominent / moderate / unclear
CHEST: prominent / moderate / unclear
ARMS: prominent / moderate / unclear
TORSO: defined / moderate / unclear
Use only a single option after each colon. Return no other content.`;
function status(message){self.postMessage({kind:'status',message})}
let running=false;
self.onmessage=async event=>{
  const {kind,images}=event.data||{};
  if(kind!=='analyse'||running)return;
  running=true;
  try{
    if(!self.navigator?.gpu)throw Error('WebGPU is not available in this browser. Use the free pose scan or a browser/device with WebGPU.');
    const adapter=await self.navigator.gpu.requestAdapter();
    if(!adapter)throw Error('This device does not offer a compatible WebGPU adapter.');
    status('Loading open-source vision model — first use downloads model files (roughly 200 MB).');
    const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
    const {AutoProcessor,AutoModelForVision2Seq,load_image}=lib;
    processorPromise??=AutoProcessor.from_pretrained(MODEL);
    modelPromise??=AutoModelForVision2Seq.from_pretrained(MODEL,{
      device:'webgpu',
      dtype:{vision_encoder:'q4',embed_tokens:'int8',decoder_model_merged:'q4'},
      progress_callback:info=>{
        if(info?.status==='progress'&&Number.isFinite(info.progress)){
          const pct=Math.round(info.progress);
          if(pct%20===0)status('Downloading free AI model… '+pct+'% of '+String(info.file||'a model file').split('/').pop());
        }
      }
    });
    const [processor,model]=await Promise.all([processorPromise,modelPromise]);
    const results={};
    for(const entry of (images||[]).slice(0,2)){
      if(!['current','goal'].includes(entry.role)||typeof entry.data!=='string'||!entry.data.startsWith('data:image/jpeg;base64,'))continue;
      status(entry.role==='current'?'Reviewing your progress photo on this device…':'Reviewing your target photo on this device…');
      const img=await load_image(entry.data);
      const messages=[{role:'user',content:[{type:'image'}, {type:'text',text:prompt}]}];
      const chat=processor.apply_chat_template(messages,{add_generation_prompt:true});
      const inputs=await processor(chat,[img],{do_image_splitting:false});
      const generated=await model.generate({...inputs,max_new_tokens:110,do_sample:false,repetition_penalty:1.1,return_dict_in_generate:true});
      const seq=generated.sequences||generated;
      // Decode *only* generated tokens: never accidentally parse labels from the question itself.
      const promptLength=inputs.input_ids?.dims?.[1];
      if(!seq?.data||!Number.isInteger(promptLength)||seq.data.length<=promptLength)throw Error('No usable response from vision model');
      const tokenIds=Array.from(seq.data.slice(promptLength),Number);
      let text=String(processor.tokenizer.decode(tokenIds,{skip_special_tokens:true})||'');
      if(text.length>1800)text=text.slice(0,1800);
      results[entry.role]=text.trim();
    }
    self.postMessage({kind:'result',results});
  }catch(err){
    processorPromise=null;modelPromise=null;
    self.postMessage({kind:'error',message:String(err?.message||err).slice(0,500)});
  }finally{running=false}
};